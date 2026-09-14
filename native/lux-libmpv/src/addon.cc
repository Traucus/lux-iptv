// In-process libmpv via dlopen/LoadLibrary. Never spawn mpv.exe.
#include <napi.h>
#include <cstdint>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#else
#include <dlfcn.h>
#endif

enum mpv_format {
  MPV_FORMAT_NONE = 0,
  MPV_FORMAT_STRING = 1,
  MPV_FORMAT_FLAG = 3,
  MPV_FORMAT_INT64 = 4,
  MPV_FORMAT_DOUBLE = 5,
  MPV_FORMAT_NODE = 6,
  MPV_FORMAT_NODE_ARRAY = 7,
  MPV_FORMAT_NODE_MAP = 8
};

struct mpv_node_list;
struct mpv_byte_array;
struct mpv_handle;

struct mpv_node {
  union {
    char *string;
    int flag;
    int64_t int64;
    double double_;
    mpv_node_list *list;
    mpv_byte_array *ba;
  } u;
  mpv_format format;
};

struct mpv_node_list {
  int num;
  mpv_node *values;
  char **keys;
};

typedef mpv_handle *(*mpv_create_fn)();
typedef int (*mpv_initialize_fn)(mpv_handle *);
typedef int (*mpv_command_fn)(mpv_handle *, const char **);
typedef int (*mpv_set_option_string_fn)(mpv_handle *, const char *, const char *);
typedef int (*mpv_set_option_fn)(mpv_handle *, const char *, mpv_format, void *);
typedef int (*mpv_set_property_string_fn)(mpv_handle *, const char *, const char *);
typedef char *(*mpv_get_property_string_fn)(mpv_handle *, const char *);
typedef int (*mpv_get_property_fn)(mpv_handle *, const char *, mpv_format, void *);
typedef void (*mpv_free_fn)(void *);
typedef void (*mpv_free_node_contents_fn)(mpv_node *);
typedef void (*mpv_terminate_destroy_fn)(mpv_handle *);

struct mpv_event {
  int event_id;
  int error;
  uint64_t reply_userdata;
  void *data;
};

typedef mpv_event *(*mpv_wait_event_fn)(mpv_handle *, double);

struct MpvApi {
  mpv_create_fn create = nullptr;
  mpv_initialize_fn initialize = nullptr;
  mpv_command_fn command = nullptr;
  mpv_set_option_string_fn set_option_string = nullptr;
  mpv_set_option_fn set_option = nullptr;
  mpv_set_property_string_fn set_property_string = nullptr;
  mpv_get_property_string_fn get_property_string = nullptr;
  mpv_get_property_fn get_property = nullptr;
  mpv_free_fn free = nullptr;
  mpv_free_node_contents_fn free_node_contents = nullptr;
  mpv_terminate_destroy_fn terminate_destroy = nullptr;
  mpv_wait_event_fn wait_event = nullptr;
};

static MpvApi g_api;
#ifdef _WIN32
static HMODULE g_lib = nullptr;
#else
static void *g_lib = nullptr;
#endif

static void *sym(const char *name) {
#ifdef _WIN32
  return reinterpret_cast<void *>(GetProcAddress(g_lib, name));
#else
  return dlsym(g_lib, name);
#endif
}

static bool load_libmpv() {
  if (g_lib) return true;
  const char *dir = std::getenv("LUX_LIBMPV_DIR");
  std::vector<std::string> names;
#ifdef _WIN32
  if (dir && dir[0]) {
    names.push_back(std::string(dir) + "\\libmpv-2.dll");
    names.push_back(std::string(dir) + "\\mpv-2.dll");
  }
  names.emplace_back("libmpv-2.dll");
  names.emplace_back("mpv-2.dll");
#else
  if (dir && dir[0]) {
    names.push_back(std::string(dir) + "/libmpv.so.2");
    names.push_back(std::string(dir) + "/libmpv.so");
  }
  names.emplace_back("libmpv.so.2");
  names.emplace_back("libmpv.so");
#endif
  for (const auto &name : names) {
#ifdef _WIN32
    g_lib = LoadLibraryA(name.c_str());
#else
    g_lib = dlopen(name.c_str(), RTLD_NOW | RTLD_LOCAL);
#endif
    if (g_lib) break;
  }
  if (!g_lib) return false;
  g_api.create = reinterpret_cast<mpv_create_fn>(sym("mpv_create"));
  g_api.initialize = reinterpret_cast<mpv_initialize_fn>(sym("mpv_initialize"));
  g_api.command = reinterpret_cast<mpv_command_fn>(sym("mpv_command"));
  g_api.set_option_string = reinterpret_cast<mpv_set_option_string_fn>(sym("mpv_set_option_string"));
  g_api.set_option = reinterpret_cast<mpv_set_option_fn>(sym("mpv_set_option"));
  g_api.set_property_string = reinterpret_cast<mpv_set_property_string_fn>(sym("mpv_set_property_string"));
  g_api.get_property_string = reinterpret_cast<mpv_get_property_string_fn>(sym("mpv_get_property_string"));
  g_api.get_property = reinterpret_cast<mpv_get_property_fn>(sym("mpv_get_property"));
  g_api.free = reinterpret_cast<mpv_free_fn>(sym("mpv_free"));
  g_api.free_node_contents = reinterpret_cast<mpv_free_node_contents_fn>(sym("mpv_free_node_contents"));
  g_api.terminate_destroy = reinterpret_cast<mpv_terminate_destroy_fn>(sym("mpv_terminate_destroy"));
  g_api.wait_event = reinterpret_cast<mpv_wait_event_fn>(sym("mpv_wait_event"));
  return g_api.create && g_api.initialize && g_api.command && g_api.terminate_destroy && g_api.wait_event;
}

#ifdef _WIN32
static ATOM g_embed_atom = 0;
static const char kEmbedClass[] = "LuxLibmpvEmbed";

static HWND create_embed_hwnd(HWND parent) {
  if (!parent) return nullptr;
  if (!g_embed_atom) {
    WNDCLASSA wc{};
    wc.lpfnWndProc = DefWindowProcA;
    wc.hInstance = GetModuleHandleA(nullptr);
    wc.lpszClassName = kEmbedClass;
    wc.hbrBackground = static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));
    wc.style = CS_OWNDC;
    g_embed_atom = RegisterClassA(&wc);
  }
  const LONG_PTR style = GetWindowLongPtrA(parent, GWL_STYLE);
  SetWindowLongPtrA(parent, GWL_STYLE, style | WS_CLIPCHILDREN);
  RECT rc{};
  GetClientRect(parent, &rc);
  // Must match src/shared/player-chrome.ts OSD_HWND_INSET.
  const int kOsdTop = 88;
  const int kOsdBottom = 168;
  const int width = rc.right - rc.left;
  const int fullHeight = rc.bottom - rc.top;
  const int height = fullHeight > kOsdTop + kOsdBottom + 1
                         ? fullHeight - kOsdTop - kOsdBottom
                         : fullHeight;
  HWND hwnd = CreateWindowExA(
      WS_EX_TRANSPARENT | WS_EX_NOACTIVATE,
      kEmbedClass,
      "",
      WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS,
      0,
      kOsdTop,
      width,
      height,
      parent,
      nullptr,
      GetModuleHandleA(nullptr),
      nullptr);
  if (hwnd) {
    SetWindowPos(hwnd, HWND_TOP, 0, kOsdTop, width, height, SWP_SHOWWINDOW);
  }
  std::fprintf(stderr, "[lux-libmpv] embed hwnd=%p parent=%p size=%dx%d y=%d\n", hwnd, parent, width, height, kOsdTop);
  std::fflush(stderr);
  return hwnd;
}

static HWND hwnd_from_buffer(const Napi::Buffer<uint8_t> &buf) {
  if (buf.Length() >= 8) {
    uint64_t raw = 0;
    std::memcpy(&raw, buf.Data(), 8);
    return reinterpret_cast<HWND>(static_cast<uintptr_t>(raw));
  }
  if (buf.Length() >= 4) {
    uint32_t raw = 0;
    std::memcpy(&raw, buf.Data(), 4);
    return reinterpret_cast<HWND>(static_cast<uintptr_t>(raw));
  }
  return nullptr;
}
#endif

class Session : public Napi::ObjectWrap<Session> {
 public:
  static Napi::Function Init(Napi::Env env) {
    return DefineClass(env, "Session", {
      InstanceMethod("play", &Session::Play),
      InstanceMethod("stop", &Session::Stop),
      InstanceMethod("setOptions", &Session::SetOptions),
      InstanceMethod("getTrackList", &Session::GetTrackList),
      InstanceMethod("setProperty", &Session::SetProperty),
      InstanceMethod("getProperty", &Session::GetProperty),
      InstanceMethod("command", &Session::Command),
    });
  }

  Session(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<Session>(info), ctx_(nullptr), initialized_(false) {
    if (!load_libmpv()) return;
    ctx_ = g_api.create();
    if (ctx_ && g_api.set_option_string) {
      g_api.set_option_string(ctx_, "config", "no");
      g_api.set_option_string(ctx_, "load-scripts", "no");
      g_api.set_option_string(ctx_, "ytdl", "no");
      g_api.set_option_string(ctx_, "osc", "no");
      g_api.set_option_string(ctx_, "user-agent",
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    }
  }

  ~Session() {
    stop_pump();
#ifdef _WIN32
    destroy_embed();
#endif
    if (ctx_ && g_api.terminate_destroy) g_api.terminate_destroy(ctx_);
    ctx_ = nullptr;
  }

  bool ok() const { return ctx_ != nullptr; }

  private:
  enum class OpenState { Idle, Pending, Loaded, Failed };

  mpv_handle *ctx_;
  bool initialized_;
  std::atomic<bool> pump_run_{false};
  std::thread pump_;
  std::mutex mu_;
  std::condition_variable cv_;
  OpenState open_ = OpenState::Idle;
#ifdef _WIN32
  HWND embed_ = nullptr;

  void destroy_embed() {
    if (embed_) {
      DestroyWindow(embed_);
      embed_ = nullptr;
    }
  }
#endif

  void start_pump() {
    if (!g_api.wait_event || pump_.joinable()) return;
    pump_run_ = true;
    pump_ = std::thread([this]() {
      std::fprintf(stderr, "[lux-libmpv] event pump start\n");
      std::fflush(stderr);
      while (pump_run_ && ctx_ && g_api.wait_event) {
        mpv_event *ev = g_api.wait_event(ctx_, 0.05);
        if (!ev || ev->event_id == 0) continue;
        if (ev->event_id == 8) {
          std::lock_guard<std::mutex> lock(mu_);
          open_ = OpenState::Loaded;
          cv_.notify_all();
        } else if (ev->event_id == 7) {
          std::lock_guard<std::mutex> lock(mu_);
          if (open_ == OpenState::Pending) {
            open_ = OpenState::Failed;
            cv_.notify_all();
          }
        }
      }
      std::fprintf(stderr, "[lux-libmpv] event pump stop\n");
      std::fflush(stderr);
    });
  }

  void stop_pump() {
    pump_run_ = false;
    if (pump_.joinable()) pump_.join();
  }

  bool ensure_initialized(void *parent_hwnd) {
    if (!ctx_) return false;
    if (initialized_) {
#ifdef _WIN32
      if (embed_) ShowWindow(embed_, SW_SHOW);
#else
      (void)parent_hwnd;
#endif
      return true;
    }
#ifdef _WIN32
    HWND parent = static_cast<HWND>(parent_hwnd);
    if (parent && g_api.set_option) {
      destroy_embed();
      embed_ = create_embed_hwnd(parent);
      if (embed_) {
        int64_t wid = reinterpret_cast<int64_t>(embed_);
        g_api.set_option(ctx_, "wid", MPV_FORMAT_INT64, &wid);
      }
    }
    if (g_api.set_option_string) {
      g_api.set_option_string(ctx_, "vo", "gpu");
      g_api.set_option_string(ctx_, "terminal", "yes");
      g_api.set_option_string(ctx_, "msg-level", "all=v,curl=debug,ffmpeg=debug");
      g_api.set_option_string(ctx_, "network-timeout", "30");
    }
#else
    (void)parent_hwnd;
    if (g_api.set_option_string) {
      g_api.set_option_string(ctx_, "terminal", "yes");
      g_api.set_option_string(ctx_, "msg-level", "all=v");
    }
#endif
    const int init = g_api.initialize(ctx_);
    std::fprintf(stderr, "[lux-libmpv] initialize=%d\n", init);
    std::fflush(stderr);
    if (init < 0) {
      g_api.terminate_destroy(ctx_);
      ctx_ = nullptr;
      return false;
    }
    initialized_ = true;
    start_pump();
    return true;
  }

  Napi::Value Play(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!ctx_ || info.Length() < 1 || !info[0].IsString()) return env.Undefined();
    std::string url = info[0].As<Napi::String>().Utf8Value();
    if (info.Length() >= 2 && info[1].IsObject() && g_api.set_option_string) {
      Napi::Object headers = info[1].As<Napi::Object>();
      Napi::Array keys = headers.GetPropertyNames();
      std::string joined;
      for (uint32_t i = 0; i < keys.Length(); i++) {
        std::string key = keys.Get(i).ToString().Utf8Value();
        std::string val = headers.Get(key).ToString().Utf8Value();
        if (!joined.empty()) joined += "\r\n";
        joined += key + ": " + val;
      }
      if (!joined.empty()) {
        g_api.set_option_string(ctx_, "http-header-fields", joined.c_str());
        std::fprintf(stderr, "[lux-libmpv] headers=%s\n", joined.c_str());
        std::fflush(stderr);
      }
    }
    void *parent_hwnd = nullptr;
#ifdef _WIN32
    if (info.Length() >= 3 && info[2].IsBuffer()) {
      parent_hwnd = hwnd_from_buffer(info[2].As<Napi::Buffer<uint8_t>>());
    }
#endif
    if (!ensure_initialized(parent_hwnd)) {
      std::fprintf(stderr, "[lux-libmpv] initialize failed url=%s\n", url.c_str());
      std::fflush(stderr);
      return Napi::Boolean::New(env, false);
    }
    {
      std::lock_guard<std::mutex> lock(mu_);
      open_ = OpenState::Pending;
    }
    const char *cmd[] = {"loadfile", url.c_str(), nullptr};
    const int loaded = g_api.command(ctx_, cmd);
    std::fprintf(stderr, "[lux-libmpv] loadfile=%d url=%s\n", loaded, url.c_str());
    std::fflush(stderr);
    if (loaded < 0) return Napi::Boolean::New(env, false);
    std::unique_lock<std::mutex> lock(mu_);
    cv_.wait_for(lock, std::chrono::seconds(20), [this] { return open_ != OpenState::Pending; });
    const bool ok = open_ == OpenState::Loaded;
    std::fprintf(stderr, "[lux-libmpv] open=%s\n", ok ? "loaded" : "failed");
    std::fflush(stderr);
    return Napi::Boolean::New(env, ok);
  }

  Napi::Value Stop(const Napi::CallbackInfo &info) {
    if (ctx_ && g_api.command) {
      const char *cmd[] = {"stop", nullptr};
      g_api.command(ctx_, cmd);
    }
#ifdef _WIN32
    if (embed_) ShowWindow(embed_, SW_HIDE);
#endif
    return info.Env().Undefined();
  }

  Napi::Value SetOptions(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!ctx_ || !g_api.set_option_string || info.Length() < 1 || !info[0].IsObject()) {
      return env.Undefined();
    }
    Napi::Object opts = info[0].As<Napi::Object>();
    Napi::Array keys = opts.GetPropertyNames();
    for (uint32_t i = 0; i < keys.Length(); i++) {
      std::string key = keys.Get(i).ToString().Utf8Value();
      std::string val = opts.Get(key).ToString().Utf8Value();
      g_api.set_option_string(ctx_, key.c_str(), val.c_str());
    }
    return env.Undefined();
  }

  Napi::Value SetProperty(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!ctx_ || !g_api.set_property_string || info.Length() < 2 || !info[0].IsString()) {
      return env.Undefined();
    }
    std::string name = info[0].As<Napi::String>().Utf8Value();
    std::string val = info[1].ToString().Utf8Value();
    g_api.set_property_string(ctx_, name.c_str(), val.c_str());
    return env.Undefined();
  }

  Napi::Value GetProperty(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!ctx_ || !g_api.get_property_string || info.Length() < 1 || !info[0].IsString()) {
      return env.Undefined();
    }
    std::string name = info[0].As<Napi::String>().Utf8Value();
    char *raw = g_api.get_property_string(ctx_, name.c_str());
    if (!raw) return env.Undefined();
    Napi::String out = Napi::String::New(env, raw);
    if (g_api.free) g_api.free(raw);
    return out;
  }

  Napi::Value Command(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!ctx_ || info.Length() < 1 || !info[0].IsArray()) return env.Undefined();
    Napi::Array arr = info[0].As<Napi::Array>();
    std::vector<std::string> owned;
    std::vector<const char *> args;
    owned.reserve(arr.Length());
    for (uint32_t i = 0; i < arr.Length(); i++) {
      owned.push_back(arr.Get(i).ToString().Utf8Value());
    }
    for (const auto &s : owned) args.push_back(s.c_str());
    args.push_back(nullptr);
    g_api.command(ctx_, args.data());
    return env.Undefined();
  }

  Napi::Value GetTrackList(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    Napi::Array out = Napi::Array::New(env);
    if (!ctx_ || !g_api.get_property || !g_api.free_node_contents) return out;
    mpv_node node{};
    if (g_api.get_property(ctx_, "track-list", MPV_FORMAT_NODE, &node) < 0) return out;
    if (node.format == MPV_FORMAT_NODE_ARRAY && node.u.list) {
      mpv_node_list *list = node.u.list;
      uint32_t n = 0;
      for (int i = 0; i < list->num; i++) {
        mpv_node &item = list->values[i];
        if (item.format != MPV_FORMAT_NODE_MAP || !item.u.list) continue;
        Napi::Object track = Napi::Object::New(env);
        mpv_node_list *map = item.u.list;
        for (int k = 0; k < map->num; k++) {
          const char *key = map->keys ? map->keys[k] : nullptr;
          if (!key) continue;
          mpv_node &val = map->values[k];
          if (std::strcmp(key, "id") == 0 && val.format == MPV_FORMAT_INT64) {
            track.Set("id", Napi::Number::New(env, static_cast<double>(val.u.int64)));
          } else if (std::strcmp(key, "type") == 0 && val.format == MPV_FORMAT_STRING && val.u.string) {
            track.Set("type", Napi::String::New(env, val.u.string));
          } else if (std::strcmp(key, "title") == 0 && val.format == MPV_FORMAT_STRING && val.u.string) {
            track.Set("title", Napi::String::New(env, val.u.string));
          } else if (std::strcmp(key, "lang") == 0 && val.format == MPV_FORMAT_STRING && val.u.string) {
            track.Set("lang", Napi::String::New(env, val.u.string));
          }
        }
        out.Set(n++, track);
      }
    }
    g_api.free_node_contents(&node);
    return out;
  }
};

static Napi::FunctionReference g_ctor;

static Napi::Value Create(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  if (!load_libmpv()) return env.Null();
  Napi::Object session = g_ctor.New({});
  Session *wrap = Napi::ObjectWrap<Session>::Unwrap(session);
  if (!wrap || !wrap->ok()) return env.Null();
  return session;
}

static Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  g_ctor = Napi::Persistent(Session::Init(env));
  g_ctor.SuppressDestruct();
  exports.Set("create", Napi::Function::New(env, Create));
  return exports;
}

NODE_API_MODULE(lux_libmpv, InitAll)
