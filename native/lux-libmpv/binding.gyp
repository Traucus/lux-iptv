{
  "targets": [
    {
      "target_name": "lux-libmpv",
      "sources": ["src/addon.cc"],
      "include_dirs": ["../../node_modules/node-addon-api"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17"],
      "conditions": [
        [
          "OS=='win'",
          {
            "msvs_settings": {
              "VCCLCompilerTool": { "ExceptionHandling": 1 }
            }
          }
        ]
      ]
    }
  ]
}
