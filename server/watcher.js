import chokidar from "chokidar";

export function createWatcher(dir, onChange) {
  const watcher = chokidar.watch(dir, {
    ignored: /(^|[\\/])\../,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  let timeout = null;
  const debounced = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => onChange(), 100);
  };

  watcher
    .on("add", debounced)
    .on("change", debounced)
    .on("unlink", debounced)
    .on("addDir", debounced)
    .on("unlinkDir", debounced);

  return watcher;
}
