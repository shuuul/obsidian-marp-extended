// Import this named export into your test file:
export const TFile = jest.fn().mockImplementation(() => {
  return {
    constructor: () => {},
    path: String,
    parent: () => new TFile,
    vault: new Vault()
  };
});

export const Vault = jest.fn().mockImplementation(() => {
  return {
    constructor: () => {},
    adapter: new FileSystemAdapter,
    getConfig: () => { return "relative"; },
    getFiles: () => [],
    cachedRead: async () => '',
  }
});

export const FileSystemAdapter = jest.fn().mockImplementation(() => {
  let _path = "";
  const files = new Map<string, string>();
  const binaryFiles = new Map<string, ArrayBuffer>();
  const folders = new Set<string>();
  return {
    constructor: () => {},
    write: async (path: string, data: string) => { _path = path; files.set(normalizePath(path), data); },
    read: async (path: string) => files.get(normalizePath(path)) ?? '',
    writeBinary: async (path: string, data: ArrayBuffer) => { _path = path; binaryFiles.set(normalizePath(path), data); },
    readBinary: async (path: string) => binaryFiles.get(normalizePath(path)) ?? new ArrayBuffer(0),
    exists: async (path: string) => files.has(normalizePath(path)) || binaryFiles.has(normalizePath(path)) || folders.has(normalizePath(path)),
    mkdir: async (path: string) => { folders.add(normalizePath(path)); },
    remove: async (path: string) => { files.delete(normalizePath(path)); folders.delete(normalizePath(path)); },
    list: async (path: string) => {
      const normalized = normalizePath(path);
      const prefix = normalized.endsWith('/') ? normalized : `${normalized}/`;
      return {
        files: [...files.keys(), ...binaryFiles.keys()].filter((file) => file.startsWith(prefix)),
        folders: [...folders].filter((folder) => folder.startsWith(prefix)),
      };
    },
    getBasePath: () => { return _path; },
    getResourcePath: (path: string) => {
      const normalizedPath = normalizePath(path);
      const normalizedLastPath = normalizePath(_path);
      const resourcePath = normalizedLastPath === normalizedPath || normalizedLastPath.endsWith(`/${normalizedPath}`)
        ? normalizedLastPath
        : normalizedPath;
      return  `app://local/${resourcePath}?aaaa`;
    }
  }
});

export const requestUrl = jest.fn();

export const Notice = jest.fn().mockImplementation(() => ({
  hide: jest.fn(),
}));

export const Modal = jest.fn().mockImplementation(() => ({
  app: {},
  titleEl: document.createElement('div'),
  contentEl: document.createElement('div'),
  open: jest.fn(),
  close: jest.fn(),
}));


export const normalizePath = jest.fn().mockImplementation((str: string) => { 
  return normalize(str)
})

function normalize (path: string) {
  if (typeof path !== 'string') {
    console.log(path);
    throw new TypeError('expected path to be a string');
  }

  if (path === '\\' || path === '/') return '/';

  const len = path.length;
  if (len <= 1) return path;

  // ensure that win32 namespaces has two leading slashes, so that the path is
  // handled properly by the win32 version of path.parse() after being normalized
  // https://msdn.microsoft.com/library/windows/desktop/aa365247(v=vs.85).aspx#namespaces
  let prefix = '';
  if (len > 4 && path[3] === '\\') {
    const ch = path[2];
    if ((ch === '?' || ch === '.') && path.slice(0, 2) === '\\\\') {
      path = path.slice(2);
      prefix = '//';
    }
  }

  const segs = path.split(/[/\\]+/);
  return prefix + segs.join('/');
}
