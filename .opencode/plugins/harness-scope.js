import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const WRITE_TOOLS = new Set(["write", "edit", "apply_patch"])
const POLICY_REL = path.join(".harness", "policies", "current.yml")
const NEVER_BASENAMES = new Set(["package.json", "package-lock.json"])

function parsePolicy(text) {
  let id = ""
  const allowed = []
  for (const raw of text.split(/\r?\n/)) {
    const idMatch = raw.match(/^\s*id:\s*(.+?)\s*$/)
    if (idMatch) {
      id = idMatch[1].trim()
      continue
    }
    const globMatch = raw.match(/^\s*-\s+(\S+)\s*$/)
    if (globMatch) allowed.push(globMatch[1])
  }
  return { id, allowed }
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DS::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DS::/g, ".*")
  return new RegExp(`^${escaped}$`)
}

function matchesAllowed(rel, allowed) {
  return allowed.some((glob) => globToRegExp(glob).test(rel))
}

function parsePatchPaths(patch) {
  const found = []
  for (const line of patch.split(/\r?\n/)) {
    const marker = line.match(/^\*\*\* (?:Add|Update|Delete) File:\s+(.+)$/)
    if (marker) {
      found.push(marker[1].trim())
      continue
    }
    const git = line.match(/^diff --git a\/(.+) b\/(.+)$/)
    if (git) {
      found.push(git[1], git[2])
      continue
    }
    const plus = line.match(/^\+\+\+ (?:b\/)?(.+)$/)
    if (plus && plus[1] !== "/dev/null") found.push(plus[1])
  }
  if (found.length === 0) return null
  return found
}

function collectPaths(tool, args) {
  if (!args || typeof args !== "object") return null
  const paths = []
  for (const key of ["filePath", "filepath", "path", "file"]) {
    if (typeof args[key] === "string" && args[key]) paths.push(args[key])
  }
  if (Array.isArray(args.files)) {
    for (const item of args.files) {
      if (typeof item === "string") paths.push(item)
      else if (item && typeof item.path === "string") paths.push(item.path)
      else if (item && typeof item.filePath === "string") paths.push(item.filePath)
    }
  }
  if (tool === "apply_patch") {
    const patch = args.patch || args.diff || args.input
    if (typeof patch !== "string") return null
    const fromPatch = parsePatchPaths(patch)
    if (!fromPatch) return null
    paths.push(...fromPatch)
  }
  if (paths.length === 0) return null
  return paths
}

function toRepoRelative(root, filePath) {
  const resolved = path.resolve(root, filePath)
  const rel = path.relative(root, resolved)
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null
  return rel.split(path.sep).join("/")
}

function isNeverAllowed(root, rel, resolved) {
  const base = path.posix.basename(rel)
  if (NEVER_BASENAMES.has(base)) return true
  if (base === ".env" || base.startsWith(".env.")) return true
  if (rel === "openspec/config.yaml") return true
  const homeOpencode = path.resolve(os.homedir(), ".config", "opencode")
  if (resolved === homeOpencode || resolved.startsWith(homeOpencode + path.sep)) return true
  return false
}

export const HarnessScope = async ({ directory, worktree }) => {
  const root = worktree || directory

  return {
    "tool.execute.before": async (input, output) => {
      const tool = String(input.tool || "").toLowerCase()
      if (!WRITE_TOOLS.has(tool)) return

      const args = output.args
      const paths = collectPaths(tool, args)
      if (!paths) {
        throw new Error(`harness-scope: blocked ${tool} (could not extract paths safely)`)
      }

      let policyText
      try {
        policyText = fs.readFileSync(path.join(root, POLICY_REL), "utf8")
      } catch {
        throw new Error("harness-scope: missing .harness/policies/current.yml")
      }
      const policy = parsePolicy(policyText)
      if (policy.allowed.length === 0) {
        throw new Error("harness-scope: current.yml has no allowed globs")
      }

      for (const rawPath of paths) {
        const rel = toRepoRelative(root, rawPath)
        if (!rel) {
          throw new Error(`harness-scope: path escapes repo: ${rawPath}`)
        }
        const resolved = path.resolve(root, rel)
        if (isNeverAllowed(root, rel, resolved)) {
          throw new Error(`harness-scope: never-allowed path: ${rel}`)
        }
        if (!matchesAllowed(rel, policy.allowed)) {
          throw new Error(`harness-scope: path not in allowlist (${policy.id}): ${rel}`)
        }
      }
    },
  }
}

export default HarnessScope
