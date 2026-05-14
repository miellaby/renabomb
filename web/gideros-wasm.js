// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != "undefined" ? Module : {};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).
// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window == "object";

var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";

// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process == "object" && process.versions?.node && process.type != "renderer";

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// include: gidjs.js
Module.preRun.push(function() {
  //			__ATPRERUN__.push(function() {
  //});
  Module.setStatus("Loading application...");
  // Load GAPP if supplied
  Module.hasGApp = ((typeof (GAPP_URL) != "undefined") && (GAPP_URL != null));
  if (Module.hasGApp) {
    if (GAPP_URL.endsWith(".gidz")) {
      Module["addRunDependency"]("gidLoadGApp");
      var loader = JZPLoadPromise(GAPP_URL, "array").then(function(c) {
        console.log("Copying application");
        FS.createPreloadedFile("/", "main.gapp", c, true, false);
        console.log("Application ready");
        Module["removeRunDependency"]("gidLoadGApp");
      });
    } else FS.createPreloadedFile("/", "main.gapp", GAPP_URL, true, false);
  }
  // Initial syncfs to get existing saved files.
  Module["addRunDependency"]("syncfs");
  FS.gidSyncing = false;
  FS.mkdir("/documents");
  FS.mount(IDBFS, {}, "/documents");
  FS.documentsOk = true;
  FS.syncfs(true, function(err) {
    if (err) {
      FS.unmount("/documents");
      FS.rmdir("/documents");
      console.warn("IndexedDB not available, persistant storage disabled");
      FS.documentsOk = false;
    }
    Module["removeRunDependency"]("syncfs");
  });
  GiderosNetplayerWS = null;
  Module.JSPlugins.forEach(function(p) {
    var xhr = new Module.XMLHttpRequest;
    var tag = document.createElement("script");
    xhr.open("GET", p, true);
    xhr.onload = function(e) {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          tag.text = xhr.response;
          document.head.appendChild(tag);
        } else {
          console.error(xhr.response);
        }
        Module["removeRunDependency"](p);
      }
    };
    Module["addRunDependency"](p);
    xhr.send();
  });
  var loader = new Promise(function(resolve, reject) {
    resolve();
  });
  Module["addRunDependency"]("gidPlugins");
  var directLoader = {
    "cache": {}
  };
  directLoader.findObject = function(name) {
    return name in directLoader.cache;
  };
  directLoader.readFile = function(name, enc) {
    return directLoader.cache[name];
  };
  Module.GiderosPlugins.forEach(function(p) {
    if (p.endsWith(".gidz")) {
      loader = loader.then(function() {
        console.log("Loading plugin:" + p);
        return JZPLoadPromise(p, "array");
      }).then(function(c) {
        console.log("Instanciating plugin:" + p);
        directLoader.cache[p] = c;
        var so = loadDynamicLibrary(p, {
          global: true,
          nodelete: true,
          loadAsync: true,
          fs: directLoader
        });
        directLoader.cache[p] = undefined;
        return so;
      });
    } else {
      loader = loader.then(function() {
        return new Promise(function(resolve, reject) {
          console.log("Loading plugin:" + p);
          var xhr = new Module.XMLHttpRequest;
          xhr.open("GET", p, true);
          xhr.onload = function(e) {
            if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                resolve(xhr.response);
              } else {
                reject(xhr.response);
              }
            }
          };
          xhr.responseType = "arraybuffer";
          xhr.send();
        });
      });
      loader = loader.then(function(c) {
        console.log("Instanciating plugin:" + p);
        directLoader.cache[p] = new Uint8Array(c);
        var so = loadDynamicLibrary(p, {
          global: true,
          nodelete: true,
          loadAsync: true,
          fs: directLoader
        });
        directLoader.cache[p] = undefined;
        return so;
      });
    }
  });
  loader = loader.then(function() {
    console.log("Plugins loaded");
    Module["removeRunDependency"]("gidPlugins");
  });
});

Module.registerPlugins = function() {
  Module.GiderosPlugins.forEach(function(p) {
    var pname = p.split(".")[0].split("/").pop();
    var pentry = "g_pluginMain_" + pname;
    // var pp=getCFunc(pentry);
    Module.ccall("main_registerPlugin", "number", [ "string", "string" ], [ p, pentry ]);
    // g_registerPlugin(g_pluginMain_##symbol);
    console.log(pname);
  });
};

Module.gplatformLanguage = function() {
  var lang;
  if (navigator && navigator.userAgent && (lang = navigator.userAgent.match(/android.*\W(\w\w)-(\w\w)\W/i))) {
    lang = lang[1];
  }
  if (!lang && navigator) {
    if (navigator.language) {
      lang = navigator.language;
    } else if (navigator.browserLanguage) {
      lang = navigator.browserLanguage;
    } else if (navigator.systemLanguage) {
      lang = navigator.systemLanguage;
    } else if (navigator.userLanguage) {
      lang = navigator.userLanguage;
    }
    lang = lang.substr(0, 2);
  }
  return lang;
};

Module.gnetplayerSend = function(data) {
  if ((GiderosNetplayerWS != null) && (GiderosNetplayerWS.readyState == 1)) GiderosNetplayerWS.send(data);
};

var gid_wget = {
  wgetRequests: {},
  nextWgetRequestHandle: 0,
  getNextWgetRequestHandle: function() {
    var handle = gid_wget.nextWgetRequestHandle;
    gid_wget.nextWgetRequestHandle++;
    return handle;
  }
};

Module.ghttpjs_urlload = function(url, request, rhdr, param, arg, free, onload, onerror, onprogress) {
  var _url = url;
  var _request = request;
  var _param = param;
  var http = new XMLHttpRequest;
  http.open(_request, _url, true);
  http.responseType = "arraybuffer";
  var ptrSz = (typeof arg === "bigint") ? 8 : 4;
  while (rhdr) {
    var rk = Module.getValue(rhdr, "*");
    if (!rk) break;
    rhdr += ptrSz;
    var rv = Module.getValue(rhdr, "*");
    rhdr += ptrSz;
    http.setRequestHeader(Module.UTF8ToString(rk), Module.UTF8ToString(rv));
  }
  var handle = gid_wget.getNextWgetRequestHandle();
  // LOAD
  http.onload = function http_onload(e) {
    // if (http.status == 200 || _url.substr(0,4).toLowerCase() != "http") {
    // console.log("rhdr:"+http.getAllResponseHeaders());
    var hdrs = stringToNewUTF8(http.getAllResponseHeaders());
    var byteArray = new Uint8Array(http.response);
    var buffer = _malloc(byteArray.length);
    HEAPU8.set(byteArray, buffer >>> 0);
    if (onload) dynCall("viipiipi", onload, [ handle, arg, buffer, byteArray.length, http.status, hdrs, 0 ]);
    if (free) _free(buffer);
    _free(hdrs);
    /*
		 * } else { console.log(url+" ERROR"); if (onerror)
		 * dynCall('viiip', onerror, [handle, arg, http.status,
		 * http.statusText]); }
		 */ delete gid_wget.wgetRequests[handle];
  };
  // ERROR
  http.onerror = function http_onerror(e) {
    if (onerror) {
      dynCall("viiip", onerror, [ handle, arg, http.status, http.statusText ]);
    }
    delete gid_wget.wgetRequests[handle];
  };
  // PROGRESS
  http.onprogress = function http_onprogress(e) {
    if (onprogress) dynCall("viiiipi", onprogress, [ handle, arg, e.loaded, e.lengthComputable || e.lengthComputable === undefined ? e.total : 0, 0, 0 ]);
  };
  // ABORT
  http.onabort = function http_onabort(e) {
    delete gid_wget.wgetRequests[handle];
  };
  // Useful because the browser can limit the number of redirection
  try {
    if (http.channel instanceof Ci.nsIHttpChannel) http.channel.redirectionLimit = 0;
  } catch (ex) {}
  if ((_request == "POST") || (_request == "PUT")) {
    http.send(_param);
  } else {
    http.send(null);
  }
  gid_wget.wgetRequests[handle] = http;
  return handle;
};

Module.ghttpjs_urlstream = function(url, request, rhdr, param, arg, free, onload, onerror, onprogress) {
  var _url = url;
  var _request = request;
  var _param = param;
  var handle = 0;
  var gHeaders = new Headers;
  gHeaders.append("Content-Type", "image/jpeg");
  while (rhdr) {
    var rk = Module.getValue(rhdr, "*");
    if (!rk) break;
    rhdr += 4;
    //Assuming 32bit
    var rv = Module.getValue(rhdr, "*");
    rhdr += 4;
    //Assuming 32bit
    gHeaders.append(Module.UTF8ToString(rk), Module.UTF8ToString(rv));
  }
  var gInit = {
    method: _request,
    headers: gHeaders,
    mode: "cors",
    cache: "no-cache",
    body: _param
  };
  var http = new Request(_url, gInit);
  fetch(http).then(function(res) {
    if (res) {
      var ahdr = "";
      res.headers.forEach(function(value, key) {
        ahdr = ahdr + key + ": " + value + "\r\n";
      });
      if (onload) {
        var hdrs = stringToNewUTF8(ahdr);
        dynCall("viipiipi", onload, [ handle, arg, 0, 0, res.status, hdrs, 1 ]);
        _free(hdrs);
      }
      var reader = res.body.getReader();
      let charsReceived = 0;
      reader.read().then(function processText({done, value}) {
        // Result objects contain two properties:
        // done  - true if the stream has already given you all its data.
        // value - some data. Always undefined when done is true.
        if (done) {
          if (onload) {
            var hdrs = stringToNewUTF8(ahdr);
            dynCall("viipiipi", onload, [ handle, arg, 0, 0, res.status, hdrs, 0 ]);
            _free(hdrs);
          }
          return;
        }
        // value for fetch streams is a Uint8Array
        charsReceived += value.length;
        var buffer = _malloc(value.length);
        HEAPU8.set(value, buffer >>> 0);
        if (onprogress) dynCall("viiiipi", onprogress, [ handle, arg, charsReceived, 0, buffer, value.length ]);
        _free(buffer);
        // Read some more, and call this function again
        return reader.read().then(processText);
      });
    } else {
      if (onerror) {
        dynCall("viiip", onerror, [ handle, arg, res.status, res.statusText ]);
      }
    }
  });
  return handle;
};

Module.checkALMuted = function() {
  var actx = _WebAudio_ALSoft;
  if ((actx == undefined) && window.AL && window.AL.currentCtx) actx = window.AL.currentCtx.audioCtx;
  if (actx && (!Module.GidAudioUnlocked)) {
    actx.resume();
    Module.GidAudioUnlocked = true;
  }
};

Module.GiderosJSEvent = function(type, context, value, data, meta) {
  var etype = "number";
  var len = data.length;
  var dataPtr;
  if (typeof meta != "string") meta = "";
  if (typeof data == "string") {
    etype = "string";
    len = -1;
  } else {
    if (len == undefined) len = data.byteLength;
    var dataPtr = Module._malloc(len);
    HEAPU8.set(new Uint8Array(data), dataPtr >>> 0);
    data = dataPtr;
  }
  Module.ccall("JSNative_enqueueEvent", "number", [ "string", "number", "number", etype, "number", "string" ], [ type, context, value, data, len, meta ]);
  if (etype == "number") Module._free(dataPtr);
};

Module.GiderosPlayer_Play = function(project) {
  Module.ccall("JSPlayer_play", "number", [ "string" ], [ project ]);
};

Module.GiderosPlayer_Stop = function() {
  Module.ccall("JSPlayer_stop", "number", [], []);
};

Module.GiderosPlayer_WriteFile = function(project, path, data) {
  var etype = "number";
  var len = data.length;
  if (typeof data == "string") etype = "string"; else {
    var dataPtr = Module._malloc(len);
    var dataHeap = new Uint8Array(HEAPU8.buffer, dataPtr, len);
    dataHeap.set(data);
    data = dataPtr;
  }
  Module.ccall("JSPlayer_writeFile", "number", [ "string", "string", etype, "number" ], [ project, path, data, len ]);
  if (etype == "number") Module._free(dataPtr);
};

Module.JSCallJS = function(mtd, ja) {
  return JSON.stringify(eval(mtd).apply(null, JSON.parse(ja)));
};

// end include: gidjs.js
// include: gui.js
Module.gui_displayDialog = function(gid, title, message, text, cancelButton, Button1, Button2, isSecure, callback) {
  var container = document.createElement("div");
  container.setAttribute("id", "giddialog_" + gid);
  container.className = "gid_dialog_container";
  /*    document.getElementById("canvas").onmouseup = function(event){event.preventDefault()};
    document.getElementById("canvas").onmousedown = function(event){event.preventDefault()};
    document.getElementById("canvas").onclick = function(event){event.preventDefault()};
 */ var overlay = document.createElement("div");
  overlay.className = "gid_dialog_overlay";
  container.appendChild(overlay);
  var dialog_wrapper = document.createElement("div");
  dialog_wrapper.className = "gid_dialog_wrapper";
  container.appendChild(dialog_wrapper);
  var dialog = document.createElement("div");
  dialog.className = "gid_dialog";
  dialog_wrapper.appendChild(dialog);
  var titleEl = document.createElement("h1");
  titleEl.className = "gid_dialog_title";
  titleEl.innerHTML = title || "";
  dialog.appendChild(titleEl);
  var messageEl = document.createElement("p");
  messageEl.className = "gid_dialog_message";
  messageEl.innerHTML = message || "";
  dialog.appendChild(messageEl);
  if (text != null) {
    var input = document.createElement("input");
    input.className = "gid_dialog_input";
    input.value = text || "";
    if (isSecure) input.setAttribute("type", "password"); else input.setAttribute("type", "text");
    dialog.appendChild(input);
  }
  var buttons = document.createElement("div");
  buttons.className = "gid_dialog_buttons";
  dialog.appendChild(buttons);
  var button_handler = function() {
    if (callback) {
      callback(gid, parseInt(this.getAttribute("id").replace("index_", "")), this.value, (input) ? input.value : null);
    }
    Module.gui_hideDialog(gid);
  };
  var cancel = document.createElement("input");
  cancel.className = "gid_dialog_button gid_dialog_btn_cancel";
  cancel.setAttribute("id", "index_0");
  cancel.setAttribute("type", "button");
  cancel.value = cancelButton || "Cancel";
  cancel.onclick = button_handler;
  buttons.appendChild(cancel);
  if (Button1) {
    var button1 = document.createElement("input");
    button1.className = "gid_dialog_button gid_dialog_btn_1";
    button1.setAttribute("id", "index_1");
    button1.setAttribute("type", "button");
    button1.value = Button1 || "";
    button1.onclick = button_handler;
    buttons.appendChild(button1);
  }
  if (Button2) {
    var button2 = document.createElement("input");
    button2.className = "gid_dialog_button gid_dialog_btn_2";
    button2.setAttribute("id", "index_2");
    button2.setAttribute("type", "button");
    button2.value = Button2 || "";
    button2.onclick = button_handler;
    buttons.appendChild(button2);
  }
  document.body.appendChild(container);
};

Module.gui_hideDialog = function(gid) {
  if (document.getElementById("giddialog_" + gid)) {
    document.body.removeChild(document.getElementById("giddialog_" + gid));
  }
};

// end include: gui.js
var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

// In MODULARIZE mode _scriptName needs to be captured already at the very top of the page immediately when the page is parsed, so it is generated there
// before the page load. In non-MODULARIZE modes generate it here.
var _scriptName = typeof document != "undefined" ? document.currentScript?.src : undefined;

if (typeof __filename != "undefined") {
  // Node
  _scriptName = __filename;
} else if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href;
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_NODE) {
  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require("fs");
  scriptDirectory = __dirname + "/";
  // include: node_shell_read.js
  readBinary = filename => {
    // We need to re-wrap `file://` strings to URLs.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename);
    return ret;
  };
  readAsync = async (filename, binary = true) => {
    // See the comment in the `readBinary` function.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename, binary ? undefined : "utf8");
    return ret;
  };
  // end include: node_shell_read.js
  if (process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, "/");
  }
  arguments_ = process.argv.slice(2);
  // MODULARIZE will export the module in the proper place outside, we don't need to export here
  if (typeof module != "undefined") {
    module["exports"] = Module;
  }
  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };
} else // Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL(".", _scriptName).href;
  } catch {}
  {
    // include: web_or_worker_shell_read.js
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = url => {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response));
      };
    }
    readAsync = async url => {
      // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
      // See https://github.com/github/fetch/pull/92#issuecomment-140665932
      // Cordova or Electron apps are typically loaded from a file:// url.
      // So use XHR on webview if URL is a file URL.
      if (isFileURI(url)) {
        return new Promise((resolve, reject) => {
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = () => {
            if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
              // file URLs can return 0
              resolve(xhr.response);
              return;
            }
            reject(xhr.status);
          };
          xhr.onerror = reject;
          xhr.send(null);
        });
      }
      var response = await fetch(url, {
        credentials: "same-origin"
      });
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error(response.status + " : " + response.url);
    };
  }
} else {}

var out = console.log.bind(console);

var err = console.error.bind(console);

// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===
// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
var dynamicLibraries = [];

var wasmBinary;

// Wasm globals
//========================================
// Runtime essentials
//========================================
// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */ var isFileURI = filename => filename.startsWith("file://");

// include: runtime_common.js
// include: runtime_stack_check.js
// end include: runtime_stack_check.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
// end include: runtime_debug.js
// Memory management
var wasmMemory;

var /** @type {!Int8Array} */ HEAP8, /** @type {!Uint8Array} */ HEAPU8, /** @type {!Int16Array} */ HEAP16, /** @type {!Uint16Array} */ HEAPU16, /** @type {!Int32Array} */ HEAP32, /** @type {!Uint32Array} */ HEAPU32, /** @type {!Float32Array} */ HEAPF32, /** @type {!Float64Array} */ HEAPF64;

// BigInt64Array type is not correctly defined in closure
var /** not-@type {!BigInt64Array} */ HEAP64, /* BigUint64Array type is not correctly defined in closure
/** not-@type {!BigUint64Array} */ HEAPU64;

var runtimeInitialized = false;

function updateMemoryViews() {
  var b = wasmMemory.buffer;
  HEAP8 = new Int8Array(b);
  HEAP16 = new Int16Array(b);
  HEAPU8 = new Uint8Array(b);
  HEAPU16 = new Uint16Array(b);
  HEAP32 = new Int32Array(b);
  HEAPU32 = new Uint32Array(b);
  HEAPF32 = new Float32Array(b);
  HEAPF64 = new Float64Array(b);
  HEAP64 = new BigInt64Array(b);
  HEAPU64 = new BigUint64Array(b);
}

// In non-standalone/normal mode, we create the memory here.
// include: runtime_init_memory.js
// Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
function initMemory() {
  if (Module["wasmMemory"]) {
    wasmMemory = Module["wasmMemory"];
  } else {
    var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 268435456;
    /** @suppress {checkTypes} */ wasmMemory = new WebAssembly.Memory({
      "initial": INITIAL_MEMORY / 65536,
      // In theory we should not need to emit the maximum if we want "unlimited"
      // or 4GB of memory, but VMs error on that atm, see
      // https://github.com/emscripten-core/emscripten/issues/14130
      // And in the pthreads case we definitely need to emit a maximum. So
      // always emit one.
      "maximum": 65536
    });
  }
  updateMemoryViews();
}

// end include: runtime_init_memory.js
// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
var __RELOC_FUNCS__ = [];

function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
}

function initRuntime() {
  runtimeInitialized = true;
  callRuntimeCallbacks(__RELOC_FUNCS__);
  // Begin ATINITS hooks
  if (!Module["noFSInit"] && !FS.initialized) FS.init();
  TTY.init();
  SOCKFS.root = FS.mount(SOCKFS, {}, null);
  // End ATINITS hooks
  wasmExports["__wasm_call_ctors"]();
  // Begin ATPOSTCTORS hooks
  callRuntimeCallbacks(onPostCtors);
  FS.ignorePermissions = false;
}

function preMain() {}

function postRun() {
  // PThreads reuse the runtime from the main thread.
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
}

/** @param {string|number=} what */ function abort(what) {
  Module["onAbort"]?.(what);
  what = "Aborted(" + what + ")";
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);
  ABORT = true;
  what += ". Build with -sASSERTIONS for more info.";
  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.
  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  // See above, in the meantime, we resort to wasm code for trapping.
  // In case abort() is called before the module is initialized, wasmExports
  // and its exported '__trap' function is not available, in which case we throw
  // a RuntimeError.
  // We trap instead of throwing RuntimeError to prevent infinite-looping in
  // Wasm EH code (because RuntimeError is considered as a foreign exception and
  // caught by 'catch_all'), but in case throwing RuntimeError is fine because
  // the module has not even been instantiated, even less running.
  if (runtimeInitialized) {
    ___trap();
  }
  /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what);
  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

var wasmBinaryFile;

function findWasmBinary() {
  return locateFile("gideros-wasm.wasm");
}

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  // Throwing a plain string here, even though it not normally adviables since
  // this gets turning into an `abort` in instantiateArrayBuffer.
  throw "both async and sync fetching of the wasm failed";
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {}
  }
  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE) {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  return {
    "env": wasmImports,
    "wasi_snapshot_preview1": wasmImports,
    "GOT.mem": new Proxy(wasmImports, GOTHandler),
    "GOT.func": new Proxy(wasmImports, GOTHandler)
  };
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/ function receiveInstance(instance, module) {
    wasmExports = instance.exports;
    wasmExports = relocateExports(wasmExports, 1024);
    var metadata = getDylinkMetadata(module);
    if (metadata.neededDynlibs) {
      dynamicLibraries = metadata.neededDynlibs.concat(dynamicLibraries);
    }
    mergeLibSymbols(wasmExports, "main");
    LDSO.init();
    loadDylibs();
    wasmExports = applySignatureConversions(wasmExports);
    __RELOC_FUNCS__.push(wasmExports["__wasm_apply_data_relocs"]);
    assignWasmExports(wasmExports);
    removeRunDependency("wasm-instantiate");
    return wasmExports;
  }
  addRunDependency("wasm-instantiate");
  // Prefer streaming instantiation if available.
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    return receiveInstance(result["instance"], result["module"]);
  }
  var info = getWasmImports();
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module["instantiateWasm"]) {
    return new Promise((resolve, reject) => {
      Module["instantiateWasm"](info, (mod, inst) => {
        resolve(receiveInstance(mod, inst));
      });
    });
  }
  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// end include: preamble.js
// Begin JS library code
class ExitStatus {
  name="ExitStatus";
  constructor(status) {
    this.message = `Program terminated with exit(${status})`;
    this.status = status;
  }
}

var GOT = {};

var currentModuleWeakSymbols = new Set([]);

var GOTHandler = {
  get(obj, symName) {
    var rtn = GOT[symName];
    if (!rtn) {
      rtn = GOT[symName] = new WebAssembly.Global({
        "value": "i32",
        "mutable": true
      });
    }
    if (!currentModuleWeakSymbols.has(symName)) {
      // Any non-weak reference to a symbol marks it as `required`, which
      // enabled `reportUndefinedSymbols` to report undefined symbol errors
      // correctly.
      rtn.required = true;
    }
    return rtn;
  }
};

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module);
  }
};

var onPostRuns = [];

var addOnPostRun = cb => onPostRuns.push(cb);

var onPreRuns = [];

var addOnPreRun = cb => onPreRuns.push(cb);

var runDependencies = 0;

var dependenciesFulfilled = null;

var removeRunDependency = id => {
  runDependencies--;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (runDependencies == 0) {
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
};

var addRunDependency = id => {
  runDependencies++;
  Module["monitorRunDependencies"]?.(runDependencies);
};

var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder : undefined;

var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
  var maxIdx = idx + maxBytesToRead;
  if (ignoreNul) return maxIdx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on
  // null terminator by itself.
  // As a tiny code save trick, compare idx against maxIdx using a negation,
  // so that maxBytesToRead=undefined/NaN means Infinity.
  while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
  return idx;
};

/**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number=} idx
     * @param {number=} maxBytesToRead
     * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
     * @return {string}
     */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  idx >>>= 0;
  var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
  }
  var str = "";
  while (idx < endPtr) {
    // For UTF8 byte structure, see:
    // http://en.wikipedia.org/wiki/UTF-8#Description
    // https://www.ietf.org/rfc/rfc2279.txt
    // https://tools.ietf.org/html/rfc3629
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

var getDylinkMetadata = binary => {
  var offset = 0;
  var end = 0;
  function getU8() {
    return binary[offset++];
  }
  function getLEB() {
    var ret = 0;
    var mul = 1;
    while (1) {
      var byte = binary[offset++];
      ret += ((byte & 127) * mul);
      mul *= 128;
      if (!(byte & 128)) break;
    }
    return ret;
  }
  function getString() {
    var len = getLEB();
    offset += len;
    return UTF8ArrayToString(binary, offset - len, len);
  }
  function getStringList() {
    var count = getLEB();
    var rtn = [];
    while (count--) rtn.push(getString());
    return rtn;
  }
  /** @param {string=} message */ function failIf(condition, message) {
    if (condition) throw new Error(message);
  }
  if (binary instanceof WebAssembly.Module) {
    var dylinkSection = WebAssembly.Module.customSections(binary, "dylink.0");
    failIf(dylinkSection.length === 0, "need dylink section");
    binary = new Uint8Array(dylinkSection[0]);
    end = binary.length;
  } else {
    var int32View = new Uint32Array(new Uint8Array(binary.subarray(0, 24)).buffer);
    var magicNumberFound = int32View[0] == 1836278016;
    failIf(!magicNumberFound, "need to see wasm magic number");
    // \0asm
    // we should see the dylink custom section right after the magic number and wasm version
    failIf(binary[8] !== 0, "need the dylink section to be first");
    offset = 9;
    var section_size = getLEB();
    //section size
    end = offset + section_size;
    var name = getString();
    failIf(name !== "dylink.0");
  }
  var customSection = {
    neededDynlibs: [],
    tlsExports: new Set,
    weakImports: new Set,
    runtimePaths: []
  };
  var WASM_DYLINK_MEM_INFO = 1;
  var WASM_DYLINK_NEEDED = 2;
  var WASM_DYLINK_EXPORT_INFO = 3;
  var WASM_DYLINK_IMPORT_INFO = 4;
  var WASM_DYLINK_RUNTIME_PATH = 5;
  var WASM_SYMBOL_TLS = 256;
  var WASM_SYMBOL_BINDING_MASK = 3;
  var WASM_SYMBOL_BINDING_WEAK = 1;
  while (offset < end) {
    var subsectionType = getU8();
    var subsectionSize = getLEB();
    if (subsectionType === WASM_DYLINK_MEM_INFO) {
      customSection.memorySize = getLEB();
      customSection.memoryAlign = getLEB();
      customSection.tableSize = getLEB();
      customSection.tableAlign = getLEB();
    } else if (subsectionType === WASM_DYLINK_NEEDED) {
      customSection.neededDynlibs = getStringList();
    } else if (subsectionType === WASM_DYLINK_EXPORT_INFO) {
      var count = getLEB();
      while (count--) {
        var symname = getString();
        var flags = getLEB();
        if (flags & WASM_SYMBOL_TLS) {
          customSection.tlsExports.add(symname);
        }
      }
    } else if (subsectionType === WASM_DYLINK_IMPORT_INFO) {
      var count = getLEB();
      while (count--) {
        var modname = getString();
        var symname = getString();
        var flags = getLEB();
        if ((flags & WASM_SYMBOL_BINDING_MASK) == WASM_SYMBOL_BINDING_WEAK) {
          customSection.weakImports.add(symname);
        }
      }
    } else if (subsectionType === WASM_DYLINK_RUNTIME_PATH) {
      customSection.runtimePaths = getStringList();
    } else {
      // unknown subsection
      offset += subsectionSize;
    }
  }
  return customSection;
};

/**
     * @param {number} ptr
     * @param {string} type
     */ function getValue(ptr, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    return HEAP8[ptr >>> 0];

   case "i8":
    return HEAP8[ptr >>> 0];

   case "i16":
    return HEAP16[((ptr) >>> 1) >>> 0];

   case "i32":
    return HEAP32[((ptr) >>> 2) >>> 0];

   case "i64":
    return HEAP64[((ptr) >>> 3) >>> 0];

   case "float":
    return HEAPF32[((ptr) >>> 2) >>> 0];

   case "double":
    return HEAPF64[((ptr) >>> 3) >>> 0];

   case "*":
    return HEAPU32[((ptr) >>> 2) >>> 0];

   default:
    abort(`invalid type for getValue: ${type}`);
  }
}

var newDSO = (name, handle, syms) => {
  var dso = {
    refcount: Infinity,
    name,
    exports: syms,
    global: true
  };
  LDSO.loadedLibsByName[name] = dso;
  if (handle != undefined) {
    LDSO.loadedLibsByHandle[handle] = dso;
  }
  return dso;
};

var LDSO = {
  loadedLibsByName: {},
  loadedLibsByHandle: {},
  init() {
    newDSO("__main__", 0, wasmImports);
  }
};

var ___heap_base = 9423984;

var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;

var getMemory = size => {
  // After the runtime is initialized, we must only use sbrk() normally.
  if (runtimeInitialized) {
    // Currently we don't support freeing of static data when modules are
    // unloaded via dlclose.  This function is tagged as `noleakcheck` to
    // avoid having this reported as leak.
    return _calloc(size, 1);
  }
  var ret = ___heap_base;
  // Keep __heap_base stack aligned.
  var end = ret + alignMemory(size, 16);
  ___heap_base = end;
  GOT["__heap_base"].value = end;
  return ret;
};

var isInternalSym = symName => [ "__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm", "__start_em_js", "__stop_em_js" ].includes(symName) || symName.startsWith("__em_js__");

var uleb128EncodeWithLen = arr => {
  const n = arr.length;
  // Note: this LEB128 length encoding produces extra byte for n < 128,
  // but we don't care as it's only used in a temporary representation.
  return [ (n % 128) | 128, n >> 7, ...arr ];
};

var wasmTypeCodes = {
  "i": 127,
  // i32
  "p": 127,
  // i32
  "j": 126,
  // i64
  "f": 125,
  // f32
  "d": 124,
  // f64
  "e": 111
};

var generateTypePack = types => uleb128EncodeWithLen(Array.from(types, type => {
  var code = wasmTypeCodes[type];
  return code;
}));

var convertJsFunctionToWasm = (func, sig) => {
  // Rest of the module is static
  var bytes = Uint8Array.of(0, 97, 115, 109, // magic ("\0asm")
  1, 0, 0, 0, // version: 1
  1, // Type section code
  // The module is static, with the exception of the type section, which is
  // generated based on the signature passed in.
  ...uleb128EncodeWithLen([ 1, // count: 1
  96, // param types
  ...generateTypePack(sig.slice(1)), // return types (for now only supporting [] if `void` and single [T] otherwise)
  ...generateTypePack(sig[0] === "v" ? "" : sig[0]) ]), // The rest of the module is static
  2, 7, // import section
  // (import "e" "f" (func 0 (type 0)))
  1, 1, 101, 1, 102, 0, 0, 7, 5, // export section
  // (export "f" (func 0 (type 0)))
  1, 1, 102, 0, 0);
  // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  var module = new WebAssembly.Module(bytes);
  var instance = new WebAssembly.Instance(module, {
    "e": {
      "f": func
    }
  });
  var wrappedFunc = instance.exports["f"];
  return wrappedFunc;
};

var wasmTableMirror = [];

/** @type {WebAssembly.Table} */ var wasmTable = new WebAssembly.Table({
  "initial": 3478,
  "element": "anyfunc"
});

var getWasmTableEntry = funcPtr => {
  var func = wasmTableMirror[funcPtr];
  if (!func) {
    /** @suppress {checkTypes} */ wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
  }
  return func;
};

var updateTableMap = (offset, count) => {
  if (functionsInTableMap) {
    for (var i = offset; i < offset + count; i++) {
      var item = getWasmTableEntry(i);
      // Ignore null values.
      if (item) {
        functionsInTableMap.set(item, i);
      }
    }
  }
};

var functionsInTableMap;

var getFunctionAddress = func => {
  // First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap;
    updateTableMap(0, wasmTable.length);
  }
  return functionsInTableMap.get(func) || 0;
};

var freeTableIndexes = [];

var getEmptyTableSlot = () => {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  // Grow the table
  return wasmTable["grow"](1);
};

var setWasmTableEntry = (idx, func) => {
  /** @suppress {checkTypes} */ wasmTable.set(idx, func);
  // With ABORT_ON_WASM_EXCEPTIONS wasmTable.get is overridden to return wrapped
  // functions so we need to call it here to retrieve the potential wrapper correctly
  // instead of just storing 'func' directly into wasmTableMirror
  /** @suppress {checkTypes} */ wasmTableMirror[idx] = wasmTable.get(idx);
};

/** @param {string=} sig */ var addFunction = (func, sig) => {
  // Check if the function is already in the table, to ensure each function
  // gets a unique index.
  var rtn = getFunctionAddress(func);
  if (rtn) {
    return rtn;
  }
  // It's not in the table, add it now.
  var ret = getEmptyTableSlot();
  // Set the new value.
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    setWasmTableEntry(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    var wrapped = convertJsFunctionToWasm(func, sig);
    setWasmTableEntry(ret, wrapped);
  }
  functionsInTableMap.set(func, ret);
  return ret;
};

var updateGOT = (exports, replace) => {
  for (var symName in exports) {
    if (isInternalSym(symName)) {
      continue;
    }
    var value = exports[symName];
    GOT[symName] ||= new WebAssembly.Global({
      "value": "i32",
      "mutable": true
    });
    if (replace || GOT[symName].value == 0) {
      if (typeof value == "function") {
        GOT[symName].value = addFunction(value);
      } else if (typeof value == "number") {
        GOT[symName].value = value;
      } else {
        err(`unhandled export type for '${symName}': ${typeof value}`);
      }
    }
  }
};

/** @param {boolean=} replace */ var relocateExports = (exports, memoryBase, replace) => {
  var relocated = {};
  for (var e in exports) {
    var value = exports[e];
    if (typeof value == "object") {
      // a breaking change in the wasm spec, globals are now objects
      // https://github.com/WebAssembly/mutable-global/issues/1
      value = value.value;
    }
    if (typeof value == "number") {
      value += memoryBase;
    }
    relocated[e] = value;
  }
  updateGOT(relocated, replace);
  return relocated;
};

var isSymbolDefined = symName => {
  // Ignore 'stub' symbols that are auto-generated as part of the original
  // `wasmImports` used to instantiate the main module.
  var existing = wasmImports[symName];
  if (!existing || existing.stub) {
    return false;
  }
  return true;
};

var resolveGlobalSymbol = (symName, direct = false) => {
  var sym;
  if (isSymbolDefined(symName)) {
    sym = wasmImports[symName];
  }
  return {
    sym,
    name: symName
  };
};

var onPostCtors = [];

var addOnPostCtor = cb => onPostCtors.push(cb);

/**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index.
     * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
     * @return {string}
     */ var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
  ptr >>>= 0;
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : "";
};

/**
      * @param {string=} libName
      * @param {Object=} localScope
      * @param {number=} handle
      */ var loadWebAssemblyModule = (binary, flags, libName, localScope, handle) => {
  var metadata = getDylinkMetadata(binary);
  // loadModule loads the wasm module after all its dependencies have been loaded.
  // can be called both sync/async.
  function loadModule() {
    // alignments are powers of 2
    var memAlign = Math.pow(2, metadata.memoryAlign);
    // prepare memory
    var memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0;
    // TODO: add to cleanups
    var tableBase = metadata.tableSize ? wasmTable.length : 0;
    if (handle) {
      HEAP8[(handle) + (8) >>> 0] = 1;
      HEAPU32[(((handle) + (12)) >>> 2) >>> 0] = memoryBase;
      HEAP32[(((handle) + (16)) >>> 2) >>> 0] = metadata.memorySize;
      HEAPU32[(((handle) + (20)) >>> 2) >>> 0] = tableBase;
      HEAP32[(((handle) + (24)) >>> 2) >>> 0] = metadata.tableSize;
    }
    if (metadata.tableSize) {
      wasmTable.grow(metadata.tableSize);
    }
    // This is the export map that we ultimately return.  We declare it here
    // so it can be used within resolveSymbol.  We resolve symbols against
    // this local symbol map in the case there they are not present on the
    // global Module object.  We need this fallback because Modules sometime
    // need to import their own symbols
    var moduleExports;
    function resolveSymbol(sym) {
      var resolved = resolveGlobalSymbol(sym).sym;
      if (!resolved && localScope) {
        resolved = localScope[sym];
      }
      if (!resolved) {
        resolved = moduleExports[sym];
      }
      return resolved;
    }
    // TODO kill ↓↓↓ (except "symbols local to this module", it will likely be
    // not needed if we require that if A wants symbols from B it has to link
    // to B explicitly: similarly to -Wl,--no-undefined)
    // wasm dynamic libraries are pure wasm, so they cannot assist in
    // their own loading. When side module A wants to import something
    // provided by a side module B that is loaded later, we need to
    // add a layer of indirection, but worse, we can't even tell what
    // to add the indirection for, without inspecting what A's imports
    // are. To do that here, we use a JS proxy (another option would
    // be to inspect the binary directly).
    var proxyHandler = {
      get(stubs, prop) {
        // symbols that should be local to this module
        switch (prop) {
         case "__memory_base":
          return memoryBase;

         case "__table_base":
          return tableBase;
        }
        if (prop in wasmImports && !wasmImports[prop].stub) {
          // No stub needed, symbol already exists in symbol table
          var res = wasmImports[prop];
          return res;
        }
        // Return a stub function that will resolve the symbol
        // when first called.
        if (!(prop in stubs)) {
          var resolved;
          stubs[prop] = (...args) => {
            resolved ||= resolveSymbol(prop);
            return resolved(...args);
          };
        }
        return stubs[prop];
      }
    };
    var proxy = new Proxy({}, proxyHandler);
    currentModuleWeakSymbols = metadata.weakImports;
    var info = {
      "GOT.mem": new Proxy({}, GOTHandler),
      "GOT.func": new Proxy({}, GOTHandler),
      "env": proxy,
      "wasi_snapshot_preview1": proxy
    };
    function postInstantiation(module, instance) {
      // add new entries to functionsInTableMap
      updateTableMap(tableBase, metadata.tableSize);
      moduleExports = relocateExports(instance.exports, memoryBase);
      if (!flags.allowUndefined) {
        reportUndefinedSymbols();
      }
      function addEmAsm(addr, body) {
        var args = [];
        var arity = 0;
        for (;arity < 16; arity++) {
          if (body.indexOf("$" + arity) != -1) {
            args.push("$" + arity);
          } else {
            break;
          }
        }
        args = args.join(",");
        var func = `(${args}) => { ${body} };`;
        ASM_CONSTS[start] = eval(func);
      }
      // Add any EM_ASM function that exist in the side module
      if ("__start_em_asm" in moduleExports) {
        var start = moduleExports["__start_em_asm"];
        var stop = moduleExports["__stop_em_asm"];
        while (start < stop) {
          var jsString = UTF8ToString(start);
          addEmAsm(start, jsString);
          start = HEAPU8.indexOf(0, start) + 1;
        }
      }
      function addEmJs(name, cSig, body) {
        // The signature here is a C signature (e.g. "(int foo, char* bar)").
        // See `create_em_js` in emcc.py` for the build-time version of this
        // code.
        var jsArgs = [];
        cSig = cSig.slice(1, -1);
        if (cSig != "void") {
          cSig = cSig.split(",");
          for (var i in cSig) {
            var jsArg = cSig[i].split(" ").pop();
            jsArgs.push(jsArg.replace("*", ""));
          }
        }
        var func = `(${jsArgs}) => ${body};`;
        moduleExports[name] = eval(func);
      }
      for (var name in moduleExports) {
        if (name.startsWith("__em_js__")) {
          var start = moduleExports[name];
          var jsString = UTF8ToString(start);
          // EM_JS strings are stored in the data section in the form
          // SIG<::>BODY.
          var parts = jsString.split("<::>");
          addEmJs(name.replace("__em_js__", ""), parts[0], parts[1]);
          delete moduleExports[name];
        }
      }
      // initialize the module
      var applyRelocs = moduleExports["__wasm_apply_data_relocs"];
      if (applyRelocs) {
        if (runtimeInitialized) {
          applyRelocs();
        } else {
          __RELOC_FUNCS__.push(applyRelocs);
        }
      }
      var init = moduleExports["__wasm_call_ctors"];
      if (init) {
        if (runtimeInitialized) {
          init();
        } else {
          // we aren't ready to run compiled code yet
          addOnPostCtor(init);
        }
      }
      return moduleExports;
    }
    if (flags.loadAsync) {
      return (async () => {
        var instance;
        if (binary instanceof WebAssembly.Module) {
          instance = new WebAssembly.Instance(binary, info);
        } else {
          // Destructuring assignment without declaration has to be wrapped
          // with parens or parser will treat the l-value as an object
          // literal instead.
          ((({module: binary, instance} = await WebAssembly.instantiate(binary, info))));
        }
        return postInstantiation(binary, instance);
      })();
    }
    var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary);
    var instance = new WebAssembly.Instance(module, info);
    return postInstantiation(module, instance);
  }
  // We need to set rpath in flags based on the current library's rpath.
  // We can't mutate flags or else if a depends on b and c and b depends on d,
  // then c will be loaded with b's rpath instead of a's.
  flags = {
    ...flags,
    rpath: {
      parentLibPath: libName,
      paths: metadata.runtimePaths
    }
  };
  // now load needed libraries and the module itself.
  if (flags.loadAsync) {
    return metadata.neededDynlibs.reduce((chain, dynNeeded) => chain.then(() => loadDynamicLibrary(dynNeeded, flags, localScope)), Promise.resolve()).then(loadModule);
  }
  metadata.neededDynlibs.forEach(needed => loadDynamicLibrary(needed, flags, localScope));
  return loadModule();
};

var mergeLibSymbols = (exports, libName) => {
  // add symbols into global namespace TODO: weak linking etc.
  for (var [sym, exp] of Object.entries(exports)) {
    // When RTLD_GLOBAL is enabled, the symbols defined by this shared object
    // will be made available for symbol resolution of subsequently loaded
    // shared objects.
    // We should copy the symbols (which include methods and variables) from
    // SIDE_MODULE to MAIN_MODULE.
    const setImport = target => {
      if (!isSymbolDefined(target)) {
        wasmImports[target] = exp;
      }
    };
    setImport(sym);
  }
};

var asyncLoad = async url => {
  var arrayBuffer = await readAsync(url);
  return new Uint8Array(arrayBuffer);
};

var preloadPlugins = [];

var registerWasmPlugin = () => {
  // Use string keys here for public methods to avoid minification since the
  // plugin consumer also uses string keys.
  var wasmPlugin = {
    promiseChainEnd: Promise.resolve(),
    "canHandle": name => !Module["noWasmDecoding"] && name.endsWith(".so"),
    "handle": async (byteArray, name) => // loadWebAssemblyModule can not load modules out-of-order, so rather
    // than just running the promises in parallel, this makes a chain of
    // promises to run in series.
    wasmPlugin.promiseChainEnd = wasmPlugin.promiseChainEnd.then(async () => {
      try {
        var exports = await loadWebAssemblyModule(byteArray, {
          loadAsync: true,
          nodelete: true
        }, name, {});
      } catch (error) {
        throw new Error(`failed to instantiate wasm: ${name}: ${error}`);
      }
      preloadedWasm[name] = exports;
      return byteArray;
    })
  };
  preloadPlugins.push(wasmPlugin);
};

var preloadedWasm = {};

var PATH = {
  isAbs: path => path.charAt(0) === "/",
  splitPath: filename => {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  },
  normalizeArray: (parts, allowAboveRoot) => {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (;up; up--) {
        parts.unshift("..");
      }
    }
    return parts;
  },
  normalize: path => {
    var isAbsolute = PATH.isAbs(path), trailingSlash = path.slice(-1) === "/";
    // Normalize the path
    path = PATH.normalizeArray(path.split("/").filter(p => !!p), !isAbsolute).join("/");
    if (!path && !isAbsolute) {
      path = ".";
    }
    if (path && trailingSlash) {
      path += "/";
    }
    return (isAbsolute ? "/" : "") + path;
  },
  dirname: path => {
    var result = PATH.splitPath(path), root = result[0], dir = result[1];
    if (!root && !dir) {
      // No dirname whatsoever
      return ".";
    }
    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.slice(0, -1);
    }
    return root + dir;
  },
  basename: path => path && path.match(/([^\/]+|\/)\/*$/)[1],
  join: (...paths) => PATH.normalize(paths.join("/")),
  join2: (l, r) => PATH.normalize(l + "/" + r)
};

var replaceORIGIN = (parentLibName, rpath) => {
  if (rpath.startsWith("$ORIGIN")) {
    // TODO: what to do if we only know the relative path of the file? It will return "." here.
    var origin = PATH.dirname(parentLibName);
    return rpath.replace("$ORIGIN", origin);
  }
  return rpath;
};

var stackSave = () => _emscripten_stack_get_current();

var stackRestore = val => __emscripten_stack_restore(val);

var withStackSave = f => {
  var stack = stackSave();
  var ret = f();
  stackRestore(stack);
  return ret;
};

var stackAlloc = sz => __emscripten_stack_alloc(sz);

var lengthBytesUTF8 = str => {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var c = str.charCodeAt(i);
    // possibly a lead surrogate
    if (c <= 127) {
      len++;
    } else if (c <= 2047) {
      len += 2;
    } else if (c >= 55296 && c <= 57343) {
      len += 4;
      ++i;
    } else {
      len += 3;
    }
  }
  return len;
};

var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
  outIdx >>>= 0;
  // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
  // undefined and false each don't write out any bytes.
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
    // and https://www.ietf.org/rfc/rfc2279.txt
    // and https://tools.ietf.org/html/rfc3629
    var u = str.codePointAt(i);
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++ >>> 0] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++ >>> 0] = 192 | (u >> 6);
      heap[outIdx++ >>> 0] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++ >>> 0] = 224 | (u >> 12);
      heap[outIdx++ >>> 0] = 128 | ((u >> 6) & 63);
      heap[outIdx++ >>> 0] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      heap[outIdx++ >>> 0] = 240 | (u >> 18);
      heap[outIdx++ >>> 0] = 128 | ((u >> 12) & 63);
      heap[outIdx++ >>> 0] = 128 | ((u >> 6) & 63);
      heap[outIdx++ >>> 0] = 128 | (u & 63);
      // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
      // We need to manually skip over the second code unit for correct iteration.
      i++;
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx >>> 0] = 0;
  return outIdx - startIdx;
};

var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);

var stringToUTF8OnStack = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8(str, ret, size);
  return ret;
};

var initRandomFill = () => {
  // This block is not needed on v19+ since crypto.getRandomValues is builtin
  if (ENVIRONMENT_IS_NODE) {
    var nodeCrypto = require("crypto");
    return view => nodeCrypto.randomFillSync(view);
  }
  return view => crypto.getRandomValues(view);
};

var randomFill = view => {
  // Lazily init on the first invocation.
  (randomFill = initRandomFill())(view);
};

var PATH_FS = {
  resolve: (...args) => {
    var resolvedPath = "", resolvedAbsolute = false;
    for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? args[i] : FS.cwd();
      // Skip empty and invalid entries
      if (typeof path != "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path) {
        return "";
      }
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = PATH.isAbs(path);
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(p => !!p), !resolvedAbsolute).join("/");
    return ((resolvedAbsolute ? "/" : "") + resolvedPath) || ".";
  },
  relative: (from, to) => {
    from = PATH_FS.resolve(from).slice(1);
    to = PATH_FS.resolve(to).slice(1);
    function trim(arr) {
      var start = 0;
      for (;start < arr.length; start++) {
        if (arr[start] !== "") break;
      }
      var end = arr.length - 1;
      for (;end >= 0; end--) {
        if (arr[end] !== "") break;
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  }
};

var FS_stdin_getChar_buffer = [];

/** @type {function(string, boolean=, number=)} */ var intArrayFromString = (stringy, dontAddNull, length) => {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
};

var FS_stdin_getChar = () => {
  if (!FS_stdin_getChar_buffer.length) {
    var result = null;
    if (ENVIRONMENT_IS_NODE) {
      // we will read data by chunks of BUFSIZE
      var BUFSIZE = 256;
      var buf = Buffer.alloc(BUFSIZE);
      var bytesRead = 0;
      // For some reason we must suppress a closure warning here, even though
      // fd definitely exists on process.stdin, and is even the proper way to
      // get the fd of stdin,
      // https://github.com/nodejs/help/issues/2136#issuecomment-523649904
      // This started to happen after moving this logic out of library_tty.js,
      // so it is related to the surrounding code in some unclear manner.
      /** @suppress {missingProperties} */ var fd = process.stdin.fd;
      try {
        bytesRead = fs.readSync(fd, buf, 0, BUFSIZE);
      } catch (e) {
        // Cross-platform differences: on Windows, reading EOF throws an
        // exception, but on other OSes, reading EOF returns 0. Uniformize
        // behavior by treating the EOF exception to return 0.
        if (e.toString().includes("EOF")) bytesRead = 0; else throw e;
      }
      if (bytesRead > 0) {
        result = buf.slice(0, bytesRead).toString("utf-8");
      }
    } else if (typeof window != "undefined" && typeof window.prompt == "function") {
      // Browser.
      result = window.prompt("Input: ");
      // returns null on cancel
      if (result !== null) {
        result += "\n";
      }
    } else {}
    if (!result) {
      return null;
    }
    FS_stdin_getChar_buffer = intArrayFromString(result, true);
  }
  return FS_stdin_getChar_buffer.shift();
};

var TTY = {
  ttys: [],
  init() {},
  shutdown() {},
  register(dev, ops) {
    TTY.ttys[dev] = {
      input: [],
      output: [],
      ops
    };
    FS.registerDevice(dev, TTY.stream_ops);
  },
  stream_ops: {
    open(stream) {
      var tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(43);
      }
      stream.tty = tty;
      stream.seekable = false;
    },
    close(stream) {
      // flush any pending line data
      stream.tty.ops.fsync(stream.tty);
    },
    fsync(stream) {
      stream.tty.ops.fsync(stream.tty);
    },
    read(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(60);
      }
      var bytesRead = 0;
      for (var i = 0; i < length; i++) {
        var result;
        try {
          result = stream.tty.ops.get_char(stream.tty);
        } catch (e) {
          throw new FS.ErrnoError(29);
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(6);
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset + i] = result;
      }
      if (bytesRead) {
        stream.node.atime = Date.now();
      }
      return bytesRead;
    },
    write(stream, buffer, offset, length, pos) {
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(60);
      }
      try {
        for (var i = 0; i < length; i++) {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
        }
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
      if (length) {
        stream.node.mtime = stream.node.ctime = Date.now();
      }
      return i;
    }
  },
  default_tty_ops: {
    get_char(tty) {
      return FS_stdin_getChar();
    },
    put_char(tty, val) {
      if (val === null || val === 10) {
        out(UTF8ArrayToString(tty.output));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    fsync(tty) {
      if (tty.output?.length > 0) {
        out(UTF8ArrayToString(tty.output));
        tty.output = [];
      }
    },
    ioctl_tcgets(tty) {
      // typical setting
      return {
        c_iflag: 25856,
        c_oflag: 5,
        c_cflag: 191,
        c_lflag: 35387,
        c_cc: [ 3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ]
      };
    },
    ioctl_tcsets(tty, optional_actions, data) {
      // currently just ignore
      return 0;
    },
    ioctl_tiocgwinsz(tty) {
      return [ 24, 80 ];
    }
  },
  default_tty1_ops: {
    put_char(tty, val) {
      if (val === null || val === 10) {
        err(UTF8ArrayToString(tty.output));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    fsync(tty) {
      if (tty.output?.length > 0) {
        err(UTF8ArrayToString(tty.output));
        tty.output = [];
      }
    }
  }
};

var zeroMemory = (ptr, size) => HEAPU8.fill(0, ptr, ptr + size);

var mmapAlloc = size => {
  size = alignMemory(size, 65536);
  var ptr = _emscripten_builtin_memalign(65536, size);
  if (ptr) zeroMemory(ptr, size);
  return ptr;
};

var MEMFS = {
  ops_table: null,
  mount(mount) {
    return MEMFS.createNode(null, "/", 16895, 0);
  },
  createNode(parent, name, mode, dev) {
    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
      // no supported
      throw new FS.ErrnoError(63);
    }
    MEMFS.ops_table ||= {
      dir: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr,
          lookup: MEMFS.node_ops.lookup,
          mknod: MEMFS.node_ops.mknod,
          rename: MEMFS.node_ops.rename,
          unlink: MEMFS.node_ops.unlink,
          rmdir: MEMFS.node_ops.rmdir,
          readdir: MEMFS.node_ops.readdir,
          symlink: MEMFS.node_ops.symlink
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek
        }
      },
      file: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: {
          llseek: MEMFS.stream_ops.llseek,
          read: MEMFS.stream_ops.read,
          write: MEMFS.stream_ops.write,
          mmap: MEMFS.stream_ops.mmap,
          msync: MEMFS.stream_ops.msync
        }
      },
      link: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr,
          readlink: MEMFS.node_ops.readlink
        },
        stream: {}
      },
      chrdev: {
        node: {
          getattr: MEMFS.node_ops.getattr,
          setattr: MEMFS.node_ops.setattr
        },
        stream: FS.chrdev_stream_ops
      }
    };
    var node = FS.createNode(parent, name, mode, dev);
    if (FS.isDir(node.mode)) {
      node.node_ops = MEMFS.ops_table.dir.node;
      node.stream_ops = MEMFS.ops_table.dir.stream;
      node.contents = {};
    } else if (FS.isFile(node.mode)) {
      node.node_ops = MEMFS.ops_table.file.node;
      node.stream_ops = MEMFS.ops_table.file.stream;
      node.usedBytes = 0;
      // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
      // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
      // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
      // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
      node.contents = null;
    } else if (FS.isLink(node.mode)) {
      node.node_ops = MEMFS.ops_table.link.node;
      node.stream_ops = MEMFS.ops_table.link.stream;
    } else if (FS.isChrdev(node.mode)) {
      node.node_ops = MEMFS.ops_table.chrdev.node;
      node.stream_ops = MEMFS.ops_table.chrdev.stream;
    }
    node.atime = node.mtime = node.ctime = Date.now();
    // add the new node to the parent
    if (parent) {
      parent.contents[name] = node;
      parent.atime = parent.mtime = parent.ctime = node.atime;
    }
    return node;
  },
  getFileDataAsTypedArray(node) {
    if (!node.contents) return new Uint8Array(0);
    if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
    // Make sure to not return excess unused bytes.
    return new Uint8Array(node.contents);
  },
  expandFileStorage(node, newCapacity) {
    var prevCapacity = node.contents ? node.contents.length : 0;
    if (prevCapacity >= newCapacity) return;
    // No need to expand, the storage was already large enough.
    // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
    // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
    // avoid overshooting the allocation cap by a very large margin.
    var CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>> 0);
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
    // At minimum allocate 256b for each file when expanding.
    var oldContents = node.contents;
    node.contents = new Uint8Array(newCapacity);
    // Allocate new storage.
    if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
  },
  resizeFileStorage(node, newSize) {
    if (node.usedBytes == newSize) return;
    if (newSize == 0) {
      node.contents = null;
      // Fully decommit when requesting a resize to zero.
      node.usedBytes = 0;
    } else {
      var oldContents = node.contents;
      node.contents = new Uint8Array(newSize);
      // Allocate new storage.
      if (oldContents) {
        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
      }
      node.usedBytes = newSize;
    }
  },
  node_ops: {
    getattr(node) {
      var attr = {};
      // device numbers reuse inode numbers.
      attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
      attr.ino = node.id;
      attr.mode = node.mode;
      attr.nlink = 1;
      attr.uid = 0;
      attr.gid = 0;
      attr.rdev = node.rdev;
      if (FS.isDir(node.mode)) {
        attr.size = 4096;
      } else if (FS.isFile(node.mode)) {
        attr.size = node.usedBytes;
      } else if (FS.isLink(node.mode)) {
        attr.size = node.link.length;
      } else {
        attr.size = 0;
      }
      attr.atime = new Date(node.atime);
      attr.mtime = new Date(node.mtime);
      attr.ctime = new Date(node.ctime);
      // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
      //       but this is not required by the standard.
      attr.blksize = 4096;
      attr.blocks = Math.ceil(attr.size / attr.blksize);
      return attr;
    },
    setattr(node, attr) {
      for (const key of [ "mode", "atime", "mtime", "ctime" ]) {
        if (attr[key] != null) {
          node[key] = attr[key];
        }
      }
      if (attr.size !== undefined) {
        MEMFS.resizeFileStorage(node, attr.size);
      }
    },
    lookup(parent, name) {
      // This error may happen quite a bit. To avoid overhead we reuse it (and
      // suffer a lack of stack info).
      if (!MEMFS.doesNotExistError) {
        MEMFS.doesNotExistError = new FS.ErrnoError(44);
        /** @suppress {checkTypes} */ MEMFS.doesNotExistError.stack = "<generic error, no stack>";
      }
      throw MEMFS.doesNotExistError;
    },
    mknod(parent, name, mode, dev) {
      return MEMFS.createNode(parent, name, mode, dev);
    },
    rename(old_node, new_dir, new_name) {
      var new_node;
      try {
        new_node = FS.lookupNode(new_dir, new_name);
      } catch (e) {}
      if (new_node) {
        if (FS.isDir(old_node.mode)) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          for (var i in new_node.contents) {
            throw new FS.ErrnoError(55);
          }
        }
        FS.hashRemoveNode(new_node);
      }
      // do the internal rewiring
      delete old_node.parent.contents[old_node.name];
      new_dir.contents[new_name] = old_node;
      old_node.name = new_name;
      new_dir.ctime = new_dir.mtime = old_node.parent.ctime = old_node.parent.mtime = Date.now();
    },
    unlink(parent, name) {
      delete parent.contents[name];
      parent.ctime = parent.mtime = Date.now();
    },
    rmdir(parent, name) {
      var node = FS.lookupNode(parent, name);
      for (var i in node.contents) {
        throw new FS.ErrnoError(55);
      }
      delete parent.contents[name];
      parent.ctime = parent.mtime = Date.now();
    },
    readdir(node) {
      return [ ".", "..", ...Object.keys(node.contents) ];
    },
    symlink(parent, newname, oldpath) {
      var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
      node.link = oldpath;
      return node;
    },
    readlink(node) {
      if (!FS.isLink(node.mode)) {
        throw new FS.ErrnoError(28);
      }
      return node.link;
    }
  },
  stream_ops: {
    read(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= stream.node.usedBytes) return 0;
      var size = Math.min(stream.node.usedBytes - position, length);
      if (size > 8 && contents.subarray) {
        // non-trivial, and typed array
        buffer.set(contents.subarray(position, position + size), offset);
      } else {
        for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
      }
      return size;
    },
    write(stream, buffer, offset, length, position, canOwn) {
      // If the buffer is located in main memory (HEAP), and if
      // memory can grow, we can't hold on to references of the
      // memory buffer, as they may get invalidated. That means we
      // need to do copy its contents.
      if (buffer.buffer === HEAP8.buffer) {
        canOwn = false;
      }
      if (!length) return 0;
      var node = stream.node;
      node.mtime = node.ctime = Date.now();
      if (buffer.subarray && (!node.contents || node.contents.subarray)) {
        // This write is from a typed array to a typed array?
        if (canOwn) {
          node.contents = buffer.subarray(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (node.usedBytes === 0 && position === 0) {
          // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
          node.contents = buffer.slice(offset, offset + length);
          node.usedBytes = length;
          return length;
        } else if (position + length <= node.usedBytes) {
          // Writing to an already allocated and used subrange of the file?
          node.contents.set(buffer.subarray(offset, offset + length), position);
          return length;
        }
      }
      // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
      MEMFS.expandFileStorage(node, position + length);
      if (node.contents.subarray && buffer.subarray) {
        // Use typed array write which is available.
        node.contents.set(buffer.subarray(offset, offset + length), position);
      } else {
        for (var i = 0; i < length; i++) {
          node.contents[position + i] = buffer[offset + i];
        }
      }
      node.usedBytes = Math.max(node.usedBytes, position + length);
      return length;
    },
    llseek(stream, offset, whence) {
      var position = offset;
      if (whence === 1) {
        position += stream.position;
      } else if (whence === 2) {
        if (FS.isFile(stream.node.mode)) {
          position += stream.node.usedBytes;
        }
      }
      if (position < 0) {
        throw new FS.ErrnoError(28);
      }
      return position;
    },
    mmap(stream, length, position, prot, flags) {
      if (!FS.isFile(stream.node.mode)) {
        throw new FS.ErrnoError(43);
      }
      var ptr;
      var allocated;
      var contents = stream.node.contents;
      // Only make a new copy when MAP_PRIVATE is specified.
      if (!(flags & 2) && contents && contents.buffer === HEAP8.buffer) {
        // We can't emulate MAP_SHARED when the file is not backed by the
        // buffer we're mapping to (e.g. the HEAP buffer).
        allocated = false;
        ptr = contents.byteOffset;
      } else {
        allocated = true;
        ptr = mmapAlloc(length);
        if (!ptr) {
          throw new FS.ErrnoError(48);
        }
        if (contents) {
          // Try to avoid unnecessary slices.
          if (position > 0 || position + length < contents.length) {
            if (contents.subarray) {
              contents = contents.subarray(position, position + length);
            } else {
              contents = Array.prototype.slice.call(contents, position, position + length);
            }
          }
          HEAP8.set(contents, ptr >>> 0);
        }
      }
      return {
        ptr,
        allocated
      };
    },
    msync(stream, buffer, offset, length, mmapFlags) {
      MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
      // should we check if bytesWritten and length are the same?
      return 0;
    }
  }
};

var FS_modeStringToFlags = str => {
  var flagModes = {
    "r": 0,
    "r+": 2,
    "w": 512 | 64 | 1,
    "w+": 512 | 64 | 2,
    "a": 1024 | 64 | 1,
    "a+": 1024 | 64 | 2
  };
  var flags = flagModes[str];
  if (typeof flags == "undefined") {
    throw new Error(`Unknown file open mode: ${str}`);
  }
  return flags;
};

var FS_getMode = (canRead, canWrite) => {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
};

var IDBFS = {
  dbs: {},
  indexedDB: () => indexedDB,
  DB_VERSION: 21,
  DB_STORE_NAME: "FILE_DATA",
  queuePersist: mount => {
    function onPersistComplete() {
      if (mount.idbPersistState === "again") startPersist(); else mount.idbPersistState = 0;
    }
    function startPersist() {
      mount.idbPersistState = "idb";
      // Mark that we are currently running a sync operation
      IDBFS.syncfs(mount, /*populate:*/ false, onPersistComplete);
    }
    if (!mount.idbPersistState) {
      // Programs typically write/copy/move multiple files in the in-memory
      // filesystem within a single app frame, so when a filesystem sync
      // command is triggered, do not start it immediately, but only after
      // the current frame is finished. This way all the modified files
      // inside the main loop tick will be batched up to the same sync.
      mount.idbPersistState = setTimeout(startPersist, 0);
    } else if (mount.idbPersistState === "idb") {
      // There is an active IndexedDB sync operation in-flight, but we now
      // have accumulated more files to sync. We should therefore queue up
      // a new sync after the current one finishes so that all writes
      // will be properly persisted.
      mount.idbPersistState = "again";
    }
  },
  mount: mount => {
    // reuse core MEMFS functionality
    var mnt = MEMFS.mount(mount);
    // If the automatic IDBFS persistence option has been selected, then automatically persist
    // all modifications to the filesystem as they occur.
    if (mount?.opts?.autoPersist) {
      mount.idbPersistState = 0;
      // IndexedDB sync starts in idle state
      var memfs_node_ops = mnt.node_ops;
      mnt.node_ops = {
        ...mnt.node_ops
      };
      // Clone node_ops to inject write tracking
      mnt.node_ops.mknod = (parent, name, mode, dev) => {
        var node = memfs_node_ops.mknod(parent, name, mode, dev);
        // Propagate injected node_ops to the newly created child node
        node.node_ops = mnt.node_ops;
        // Remember for each IDBFS node which IDBFS mount point they came from so we know which mount to persist on modification.
        node.idbfs_mount = mnt.mount;
        // Remember original MEMFS stream_ops for this node
        node.memfs_stream_ops = node.stream_ops;
        // Clone stream_ops to inject write tracking
        node.stream_ops = {
          ...node.stream_ops
        };
        // Track all file writes
        node.stream_ops.write = (stream, buffer, offset, length, position, canOwn) => {
          // This file has been modified, we must persist IndexedDB when this file closes
          stream.node.isModified = true;
          return node.memfs_stream_ops.write(stream, buffer, offset, length, position, canOwn);
        };
        // Persist IndexedDB on file close
        node.stream_ops.close = stream => {
          var n = stream.node;
          if (n.isModified) {
            IDBFS.queuePersist(n.idbfs_mount);
            n.isModified = false;
          }
          if (n.memfs_stream_ops.close) return n.memfs_stream_ops.close(stream);
        };
        // Persist the node we just created to IndexedDB
        IDBFS.queuePersist(mnt.mount);
        return node;
      };
      // Also kick off persisting the filesystem on other operations that modify the filesystem.
      mnt.node_ops.rmdir = (...args) => (IDBFS.queuePersist(mnt.mount), memfs_node_ops.rmdir(...args));
      mnt.node_ops.symlink = (...args) => (IDBFS.queuePersist(mnt.mount), memfs_node_ops.symlink(...args));
      mnt.node_ops.unlink = (...args) => (IDBFS.queuePersist(mnt.mount), memfs_node_ops.unlink(...args));
      mnt.node_ops.rename = (...args) => (IDBFS.queuePersist(mnt.mount), memfs_node_ops.rename(...args));
    }
    return mnt;
  },
  syncfs: (mount, populate, callback) => {
    IDBFS.getLocalSet(mount, (err, local) => {
      if (err) return callback(err);
      IDBFS.getRemoteSet(mount, (err, remote) => {
        if (err) return callback(err);
        var src = populate ? remote : local;
        var dst = populate ? local : remote;
        IDBFS.reconcile(src, dst, callback);
      });
    });
  },
  quit: () => {
    Object.values(IDBFS.dbs).forEach(value => value.close());
    IDBFS.dbs = {};
  },
  getDB: (name, callback) => {
    // check the cache first
    var db = IDBFS.dbs[name];
    if (db) {
      return callback(null, db);
    }
    var req;
    try {
      req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
    } catch (e) {
      return callback(e);
    }
    if (!req) {
      return callback("Unable to connect to IndexedDB");
    }
    req.onupgradeneeded = e => {
      var db = /** @type {IDBDatabase} */ (e.target.result);
      var transaction = e.target.transaction;
      var fileStore;
      if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
        fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
      } else {
        fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
      }
      if (!fileStore.indexNames.contains("timestamp")) {
        fileStore.createIndex("timestamp", "timestamp", {
          unique: false
        });
      }
    };
    req.onsuccess = () => {
      db = /** @type {IDBDatabase} */ (req.result);
      // add to the cache
      IDBFS.dbs[name] = db;
      callback(null, db);
    };
    req.onerror = e => {
      callback(e.target.error);
      e.preventDefault();
    };
  },
  getLocalSet: (mount, callback) => {
    var entries = {};
    function isRealDir(p) {
      return p !== "." && p !== "..";
    }
    function toAbsolute(root) {
      return p => PATH.join2(root, p);
    }
    var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
    while (check.length) {
      var path = check.pop();
      var stat;
      try {
        stat = FS.stat(path);
      } catch (e) {
        return callback(e);
      }
      if (FS.isDir(stat.mode)) {
        check.push(...FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
      }
      entries[path] = {
        "timestamp": stat.mtime
      };
    }
    return callback(null, {
      type: "local",
      entries
    });
  },
  getRemoteSet: (mount, callback) => {
    var entries = {};
    IDBFS.getDB(mount.mountpoint, (err, db) => {
      if (err) return callback(err);
      try {
        var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readonly");
        transaction.onerror = e => {
          callback(e.target.error);
          e.preventDefault();
        };
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
        var index = store.index("timestamp");
        index.openKeyCursor().onsuccess = event => {
          var cursor = event.target.result;
          if (!cursor) {
            return callback(null, {
              type: "remote",
              db,
              entries
            });
          }
          entries[cursor.primaryKey] = {
            "timestamp": cursor.key
          };
          cursor.continue();
        };
      } catch (e) {
        return callback(e);
      }
    });
  },
  loadLocalEntry: (path, callback) => {
    var stat, node;
    try {
      var lookup = FS.lookupPath(path);
      node = lookup.node;
      stat = FS.stat(path);
    } catch (e) {
      return callback(e);
    }
    if (FS.isDir(stat.mode)) {
      return callback(null, {
        "timestamp": stat.mtime,
        "mode": stat.mode
      });
    } else if (FS.isFile(stat.mode)) {
      // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
      // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
      node.contents = MEMFS.getFileDataAsTypedArray(node);
      return callback(null, {
        "timestamp": stat.mtime,
        "mode": stat.mode,
        "contents": node.contents
      });
    } else {
      return callback(new Error("node type not supported"));
    }
  },
  storeLocalEntry: (path, entry, callback) => {
    try {
      if (FS.isDir(entry["mode"])) {
        FS.mkdirTree(path, entry["mode"]);
      } else if (FS.isFile(entry["mode"])) {
        FS.writeFile(path, entry["contents"], {
          canOwn: true
        });
      } else {
        return callback(new Error("node type not supported"));
      }
      FS.chmod(path, entry["mode"]);
      FS.utime(path, entry["timestamp"], entry["timestamp"]);
    } catch (e) {
      return callback(e);
    }
    callback(null);
  },
  removeLocalEntry: (path, callback) => {
    try {
      var stat = FS.stat(path);
      if (FS.isDir(stat.mode)) {
        FS.rmdir(path);
      } else if (FS.isFile(stat.mode)) {
        FS.unlink(path);
      }
    } catch (e) {
      return callback(e);
    }
    callback(null);
  },
  loadRemoteEntry: (store, path, callback) => {
    var req = store.get(path);
    req.onsuccess = event => callback(null, event.target.result);
    req.onerror = e => {
      callback(e.target.error);
      e.preventDefault();
    };
  },
  storeRemoteEntry: (store, path, entry, callback) => {
    try {
      var req = store.put(entry, path);
    } catch (e) {
      callback(e);
      return;
    }
    req.onsuccess = event => callback();
    req.onerror = e => {
      callback(e.target.error);
      e.preventDefault();
    };
  },
  removeRemoteEntry: (store, path, callback) => {
    var req = store.delete(path);
    req.onsuccess = event => callback();
    req.onerror = e => {
      callback(e.target.error);
      e.preventDefault();
    };
  },
  reconcile: (src, dst, callback) => {
    var total = 0;
    var create = [];
    Object.keys(src.entries).forEach(key => {
      var e = src.entries[key];
      var e2 = dst.entries[key];
      if (!e2 || e["timestamp"].getTime() != e2["timestamp"].getTime()) {
        create.push(key);
        total++;
      }
    });
    var remove = [];
    Object.keys(dst.entries).forEach(key => {
      if (!src.entries[key]) {
        remove.push(key);
        total++;
      }
    });
    if (!total) {
      return callback(null);
    }
    var errored = false;
    var db = src.type === "remote" ? src.db : dst.db;
    var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readwrite");
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
    function done(err) {
      if (err && !errored) {
        errored = true;
        return callback(err);
      }
    }
    // transaction may abort if (for example) there is a QuotaExceededError
    transaction.onerror = transaction.onabort = e => {
      done(e.target.error);
      e.preventDefault();
    };
    transaction.oncomplete = e => {
      if (!errored) {
        callback(null);
      }
    };
    // sort paths in ascending order so directory entries are created
    // before the files inside them
    create.sort().forEach(path => {
      if (dst.type === "local") {
        IDBFS.loadRemoteEntry(store, path, (err, entry) => {
          if (err) return done(err);
          IDBFS.storeLocalEntry(path, entry, done);
        });
      } else {
        IDBFS.loadLocalEntry(path, (err, entry) => {
          if (err) return done(err);
          IDBFS.storeRemoteEntry(store, path, entry, done);
        });
      }
    });
    // sort paths in descending order so files are deleted before their
    // parent directories
    remove.sort().reverse().forEach(path => {
      if (dst.type === "local") {
        IDBFS.removeLocalEntry(path, done);
      } else {
        IDBFS.removeRemoteEntry(store, path, done);
      }
    });
  }
};

var FS_createDataFile = (...args) => FS.createDataFile(...args);

var getUniqueRunDependency = id => id;

var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
  // Ensure plugins are ready.
  if (typeof Browser != "undefined") Browser.init();
  for (var plugin of preloadPlugins) {
    if (plugin["canHandle"](fullname)) {
      return plugin["handle"](byteArray, fullname);
    }
  }
  // In no plugin handled this file then return the original/unmodified
  // byteArray.
  return byteArray;
};

var FS_preloadFile = async (parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish) => {
  // TODO we should allow people to just pass in a complete filename instead
  // of parent and name being that we just join them anyways
  var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency(`cp ${fullname}`);
  // might have several active requests for the same fullname
  addRunDependency(dep);
  try {
    var byteArray = url;
    if (typeof url == "string") {
      byteArray = await asyncLoad(url);
    }
    byteArray = await FS_handledByPreloadPlugin(byteArray, fullname);
    preFinish?.();
    if (!dontCreateFile) {
      FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
    }
  } finally {
    removeRunDependency(dep);
  }
};

var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
  FS_preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish).then(onload).catch(onerror);
};

var FS = {
  root: null,
  mounts: [],
  devices: {},
  streams: [],
  nextInode: 1,
  nameTable: null,
  currentPath: "/",
  initialized: false,
  ignorePermissions: true,
  filesystems: null,
  syncFSRequests: 0,
  readFiles: {},
  ErrnoError: class {
    name="ErrnoError";
    // We set the `name` property to be able to identify `FS.ErrnoError`
    // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
    // - when using PROXYFS, an error can come from an underlying FS
    // as different FS objects have their own FS.ErrnoError each,
    // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
    // we'll use the reliable test `err.name == "ErrnoError"` instead
    constructor(errno) {
      this.errno = errno;
    }
  },
  FSStream: class {
    shared={};
    get object() {
      return this.node;
    }
    set object(val) {
      this.node = val;
    }
    get isRead() {
      return (this.flags & 2097155) !== 1;
    }
    get isWrite() {
      return (this.flags & 2097155) !== 0;
    }
    get isAppend() {
      return (this.flags & 1024);
    }
    get flags() {
      return this.shared.flags;
    }
    set flags(val) {
      this.shared.flags = val;
    }
    get position() {
      return this.shared.position;
    }
    set position(val) {
      this.shared.position = val;
    }
  },
  FSNode: class {
    node_ops={};
    stream_ops={};
    readMode=292 | 73;
    writeMode=146;
    mounted=null;
    constructor(parent, name, mode, rdev) {
      if (!parent) {
        parent = this;
      }
      this.parent = parent;
      this.mount = parent.mount;
      this.id = FS.nextInode++;
      this.name = name;
      this.mode = mode;
      this.rdev = rdev;
      this.atime = this.mtime = this.ctime = Date.now();
    }
    get read() {
      return (this.mode & this.readMode) === this.readMode;
    }
    set read(val) {
      val ? this.mode |= this.readMode : this.mode &= ~this.readMode;
    }
    get write() {
      return (this.mode & this.writeMode) === this.writeMode;
    }
    set write(val) {
      val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
    }
    get isFolder() {
      return FS.isDir(this.mode);
    }
    get isDevice() {
      return FS.isChrdev(this.mode);
    }
  },
  lookupPath(path, opts = {}) {
    if (!path) {
      throw new FS.ErrnoError(44);
    }
    opts.follow_mount ??= true;
    if (!PATH.isAbs(path)) {
      path = FS.cwd() + "/" + path;
    }
    // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
    linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
      // split the absolute path
      var parts = path.split("/").filter(p => !!p);
      // start at the root
      var current = FS.root;
      var current_path = "/";
      for (var i = 0; i < parts.length; i++) {
        var islast = (i === parts.length - 1);
        if (islast && opts.parent) {
          // stop resolving
          break;
        }
        if (parts[i] === ".") {
          continue;
        }
        if (parts[i] === "..") {
          current_path = PATH.dirname(current_path);
          if (FS.isRoot(current)) {
            path = current_path + "/" + parts.slice(i + 1).join("/");
            // We're making progress here, don't let many consecutive ..'s
            // lead to ELOOP
            nlinks--;
            continue linkloop;
          } else {
            current = current.parent;
          }
          continue;
        }
        current_path = PATH.join2(current_path, parts[i]);
        try {
          current = FS.lookupNode(current, parts[i]);
        } catch (e) {
          // if noent_okay is true, suppress a ENOENT in the last component
          // and return an object with an undefined node. This is needed for
          // resolving symlinks in the path when creating a file.
          if ((e?.errno === 44) && islast && opts.noent_okay) {
            return {
              path: current_path
            };
          }
          throw e;
        }
        // jump to the mount's root node if this is a mountpoint
        if (FS.isMountpoint(current) && (!islast || opts.follow_mount)) {
          current = current.mounted.root;
        }
        // by default, lookupPath will not follow a symlink if it is the final path component.
        // setting opts.follow = true will override this behavior.
        if (FS.isLink(current.mode) && (!islast || opts.follow)) {
          if (!current.node_ops.readlink) {
            throw new FS.ErrnoError(52);
          }
          var link = current.node_ops.readlink(current);
          if (!PATH.isAbs(link)) {
            link = PATH.dirname(current_path) + "/" + link;
          }
          path = link + "/" + parts.slice(i + 1).join("/");
          continue linkloop;
        }
      }
      return {
        path: current_path,
        node: current
      };
    }
    throw new FS.ErrnoError(32);
  },
  getPath(node) {
    var path;
    while (true) {
      if (FS.isRoot(node)) {
        var mount = node.mount.mountpoint;
        if (!path) return mount;
        return mount[mount.length - 1] !== "/" ? `${mount}/${path}` : mount + path;
      }
      path = path ? `${node.name}/${path}` : node.name;
      node = node.parent;
    }
  },
  hashName(parentid, name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return ((parentid + hash) >>> 0) % FS.nameTable.length;
  },
  hashAddNode(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    node.name_next = FS.nameTable[hash];
    FS.nameTable[hash] = node;
  },
  hashRemoveNode(node) {
    var hash = FS.hashName(node.parent.id, node.name);
    if (FS.nameTable[hash] === node) {
      FS.nameTable[hash] = node.name_next;
    } else {
      var current = FS.nameTable[hash];
      while (current) {
        if (current.name_next === node) {
          current.name_next = node.name_next;
          break;
        }
        current = current.name_next;
      }
    }
  },
  lookupNode(parent, name) {
    var errCode = FS.mayLookup(parent);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    var hash = FS.hashName(parent.id, name);
    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
      var nodeName = node.name;
      if (node.parent.id === parent.id && nodeName === name) {
        return node;
      }
    }
    // if we failed to find it in the cache, call into the VFS
    return FS.lookup(parent, name);
  },
  createNode(parent, name, mode, rdev) {
    var node = new FS.FSNode(parent, name, mode, rdev);
    FS.hashAddNode(node);
    return node;
  },
  destroyNode(node) {
    FS.hashRemoveNode(node);
  },
  isRoot(node) {
    return node === node.parent;
  },
  isMountpoint(node) {
    return !!node.mounted;
  },
  isFile(mode) {
    return (mode & 61440) === 32768;
  },
  isDir(mode) {
    return (mode & 61440) === 16384;
  },
  isLink(mode) {
    return (mode & 61440) === 40960;
  },
  isChrdev(mode) {
    return (mode & 61440) === 8192;
  },
  isBlkdev(mode) {
    return (mode & 61440) === 24576;
  },
  isFIFO(mode) {
    return (mode & 61440) === 4096;
  },
  isSocket(mode) {
    return (mode & 49152) === 49152;
  },
  flagsToPermissionString(flag) {
    var perms = [ "r", "w", "rw" ][flag & 3];
    if ((flag & 512)) {
      perms += "w";
    }
    return perms;
  },
  nodePermissions(node, perms) {
    if (FS.ignorePermissions) {
      return 0;
    }
    // return 0 if any user, group or owner bits are set.
    if (perms.includes("r") && !(node.mode & 292)) {
      return 2;
    } else if (perms.includes("w") && !(node.mode & 146)) {
      return 2;
    } else if (perms.includes("x") && !(node.mode & 73)) {
      return 2;
    }
    return 0;
  },
  mayLookup(dir) {
    if (!FS.isDir(dir.mode)) return 54;
    var errCode = FS.nodePermissions(dir, "x");
    if (errCode) return errCode;
    if (!dir.node_ops.lookup) return 2;
    return 0;
  },
  mayCreate(dir, name) {
    if (!FS.isDir(dir.mode)) {
      return 54;
    }
    try {
      var node = FS.lookupNode(dir, name);
      return 20;
    } catch (e) {}
    return FS.nodePermissions(dir, "wx");
  },
  mayDelete(dir, name, isdir) {
    var node;
    try {
      node = FS.lookupNode(dir, name);
    } catch (e) {
      return e.errno;
    }
    var errCode = FS.nodePermissions(dir, "wx");
    if (errCode) {
      return errCode;
    }
    if (isdir) {
      if (!FS.isDir(node.mode)) {
        return 54;
      }
      if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
        return 10;
      }
    } else {
      if (FS.isDir(node.mode)) {
        return 31;
      }
    }
    return 0;
  },
  mayOpen(node, flags) {
    if (!node) {
      return 44;
    }
    if (FS.isLink(node.mode)) {
      return 32;
    } else if (FS.isDir(node.mode)) {
      if (FS.flagsToPermissionString(flags) !== "r" || (flags & (512 | 64))) {
        // TODO: check for O_SEARCH? (== search for dir only)
        return 31;
      }
    }
    return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
  },
  checkOpExists(op, err) {
    if (!op) {
      throw new FS.ErrnoError(err);
    }
    return op;
  },
  MAX_OPEN_FDS: 4096,
  nextfd() {
    for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
      if (!FS.streams[fd]) {
        return fd;
      }
    }
    throw new FS.ErrnoError(33);
  },
  getStreamChecked(fd) {
    var stream = FS.getStream(fd);
    if (!stream) {
      throw new FS.ErrnoError(8);
    }
    return stream;
  },
  getStream: fd => FS.streams[fd],
  createStream(stream, fd = -1) {
    // clone it, so we can return an instance of FSStream
    stream = Object.assign(new FS.FSStream, stream);
    if (fd == -1) {
      fd = FS.nextfd();
    }
    stream.fd = fd;
    FS.streams[fd] = stream;
    return stream;
  },
  closeStream(fd) {
    FS.streams[fd] = null;
  },
  dupStream(origStream, fd = -1) {
    var stream = FS.createStream(origStream, fd);
    stream.stream_ops?.dup?.(stream);
    return stream;
  },
  doSetAttr(stream, node, attr) {
    var setattr = stream?.stream_ops.setattr;
    var arg = setattr ? stream : node;
    setattr ??= node.node_ops.setattr;
    FS.checkOpExists(setattr, 63);
    setattr(arg, attr);
  },
  chrdev_stream_ops: {
    open(stream) {
      var device = FS.getDevice(stream.node.rdev);
      // override node's stream ops with the device's
      stream.stream_ops = device.stream_ops;
      // forward the open call
      stream.stream_ops.open?.(stream);
    },
    llseek() {
      throw new FS.ErrnoError(70);
    }
  },
  major: dev => ((dev) >> 8),
  minor: dev => ((dev) & 255),
  makedev: (ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
    FS.devices[dev] = {
      stream_ops: ops
    };
  },
  getDevice: dev => FS.devices[dev],
  getMounts(mount) {
    var mounts = [];
    var check = [ mount ];
    while (check.length) {
      var m = check.pop();
      mounts.push(m);
      check.push(...m.mounts);
    }
    return mounts;
  },
  syncfs(populate, callback) {
    if (typeof populate == "function") {
      callback = populate;
      populate = false;
    }
    FS.syncFSRequests++;
    if (FS.syncFSRequests > 1) {
      err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
    }
    var mounts = FS.getMounts(FS.root.mount);
    var completed = 0;
    function doCallback(errCode) {
      FS.syncFSRequests--;
      return callback(errCode);
    }
    function done(errCode) {
      if (errCode) {
        if (!done.errored) {
          done.errored = true;
          return doCallback(errCode);
        }
        return;
      }
      if (++completed >= mounts.length) {
        doCallback(null);
      }
    }
    // sync all mounts
    mounts.forEach(mount => {
      if (!mount.type.syncfs) {
        return done(null);
      }
      mount.type.syncfs(mount, populate, done);
    });
  },
  mount(type, opts, mountpoint) {
    var root = mountpoint === "/";
    var pseudo = !mountpoint;
    var node;
    if (root && FS.root) {
      throw new FS.ErrnoError(10);
    } else if (!root && !pseudo) {
      var lookup = FS.lookupPath(mountpoint, {
        follow_mount: false
      });
      mountpoint = lookup.path;
      // use the absolute path
      node = lookup.node;
      if (FS.isMountpoint(node)) {
        throw new FS.ErrnoError(10);
      }
      if (!FS.isDir(node.mode)) {
        throw new FS.ErrnoError(54);
      }
    }
    var mount = {
      type,
      opts,
      mountpoint,
      mounts: []
    };
    // create a root node for the fs
    var mountRoot = type.mount(mount);
    mountRoot.mount = mount;
    mount.root = mountRoot;
    if (root) {
      FS.root = mountRoot;
    } else if (node) {
      // set as a mountpoint
      node.mounted = mount;
      // add the new mount to the current mount's children
      if (node.mount) {
        node.mount.mounts.push(mount);
      }
    }
    return mountRoot;
  },
  unmount(mountpoint) {
    var lookup = FS.lookupPath(mountpoint, {
      follow_mount: false
    });
    if (!FS.isMountpoint(lookup.node)) {
      throw new FS.ErrnoError(28);
    }
    // destroy the nodes for this mount, and all its child mounts
    var node = lookup.node;
    var mount = node.mounted;
    var mounts = FS.getMounts(mount);
    Object.keys(FS.nameTable).forEach(hash => {
      var current = FS.nameTable[hash];
      while (current) {
        var next = current.name_next;
        if (mounts.includes(current.mount)) {
          FS.destroyNode(current);
        }
        current = next;
      }
    });
    // no longer a mountpoint
    node.mounted = null;
    // remove this mount from the child mounts
    var idx = node.mount.mounts.indexOf(mount);
    node.mount.mounts.splice(idx, 1);
  },
  lookup(parent, name) {
    return parent.node_ops.lookup(parent, name);
  },
  mknod(path, mode, dev) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    if (!name) {
      throw new FS.ErrnoError(28);
    }
    if (name === "." || name === "..") {
      throw new FS.ErrnoError(20);
    }
    var errCode = FS.mayCreate(parent, name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.mknod) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.mknod(parent, name, mode, dev);
  },
  statfs(path) {
    return FS.statfsNode(FS.lookupPath(path, {
      follow: true
    }).node);
  },
  statfsStream(stream) {
    // We keep a separate statfsStream function because noderawfs overrides
    // it. In noderawfs, stream.node is sometimes null. Instead, we need to
    // look at stream.path.
    return FS.statfsNode(stream.node);
  },
  statfsNode(node) {
    // NOTE: None of the defaults here are true. We're just returning safe and
    //       sane values. Currently nodefs and rawfs replace these defaults,
    //       other file systems leave them alone.
    var rtn = {
      bsize: 4096,
      frsize: 4096,
      blocks: 1e6,
      bfree: 5e5,
      bavail: 5e5,
      files: FS.nextInode,
      ffree: FS.nextInode - 1,
      fsid: 42,
      flags: 2,
      namelen: 255
    };
    if (node.node_ops.statfs) {
      Object.assign(rtn, node.node_ops.statfs(node.mount.opts.root));
    }
    return rtn;
  },
  create(path, mode = 438) {
    mode &= 4095;
    mode |= 32768;
    return FS.mknod(path, mode, 0);
  },
  mkdir(path, mode = 511) {
    mode &= 511 | 512;
    mode |= 16384;
    return FS.mknod(path, mode, 0);
  },
  mkdirTree(path, mode) {
    var dirs = path.split("/");
    var d = "";
    for (var dir of dirs) {
      if (!dir) continue;
      if (d || PATH.isAbs(path)) d += "/";
      d += dir;
      try {
        FS.mkdir(d, mode);
      } catch (e) {
        if (e.errno != 20) throw e;
      }
    }
  },
  mkdev(path, mode, dev) {
    if (typeof dev == "undefined") {
      dev = mode;
      mode = 438;
    }
    mode |= 8192;
    return FS.mknod(path, mode, dev);
  },
  symlink(oldpath, newpath) {
    if (!PATH_FS.resolve(oldpath)) {
      throw new FS.ErrnoError(44);
    }
    var lookup = FS.lookupPath(newpath, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var newname = PATH.basename(newpath);
    var errCode = FS.mayCreate(parent, newname);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.symlink) {
      throw new FS.ErrnoError(63);
    }
    return parent.node_ops.symlink(parent, newname, oldpath);
  },
  rename(old_path, new_path) {
    var old_dirname = PATH.dirname(old_path);
    var new_dirname = PATH.dirname(new_path);
    var old_name = PATH.basename(old_path);
    var new_name = PATH.basename(new_path);
    // parents must exist
    var lookup, old_dir, new_dir;
    // let the errors from non existent directories percolate up
    lookup = FS.lookupPath(old_path, {
      parent: true
    });
    old_dir = lookup.node;
    lookup = FS.lookupPath(new_path, {
      parent: true
    });
    new_dir = lookup.node;
    if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
    // need to be part of the same mount
    if (old_dir.mount !== new_dir.mount) {
      throw new FS.ErrnoError(75);
    }
    // source must exist
    var old_node = FS.lookupNode(old_dir, old_name);
    // old path should not be an ancestor of the new path
    var relative = PATH_FS.relative(old_path, new_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(28);
    }
    // new path should not be an ancestor of the old path
    relative = PATH_FS.relative(new_path, old_dirname);
    if (relative.charAt(0) !== ".") {
      throw new FS.ErrnoError(55);
    }
    // see if the new path already exists
    var new_node;
    try {
      new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    // early out if nothing needs to change
    if (old_node === new_node) {
      return;
    }
    // we'll need to delete the old entry
    var isdir = FS.isDir(old_node.mode);
    var errCode = FS.mayDelete(old_dir, old_name, isdir);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    // need delete permissions if we'll be overwriting.
    // need create permissions if new doesn't already exist.
    errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!old_dir.node_ops.rename) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
      throw new FS.ErrnoError(10);
    }
    // if we are going to change the parent, check write permissions
    if (new_dir !== old_dir) {
      errCode = FS.nodePermissions(old_dir, "w");
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    // remove the node from the lookup hash
    FS.hashRemoveNode(old_node);
    // do the underlying fs rename
    try {
      old_dir.node_ops.rename(old_node, new_dir, new_name);
      // update old node (we do this here to avoid each backend
      // needing to)
      old_node.parent = new_dir;
    } catch (e) {
      throw e;
    } finally {
      // add the node back to the hash (in case node_ops.rename
      // changed its name)
      FS.hashAddNode(old_node);
    }
  },
  rmdir(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, true);
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.rmdir) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.rmdir(parent, name);
    FS.destroyNode(node);
  },
  readdir(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    var readdir = FS.checkOpExists(node.node_ops.readdir, 54);
    return readdir(node);
  },
  unlink(path) {
    var lookup = FS.lookupPath(path, {
      parent: true
    });
    var parent = lookup.node;
    if (!parent) {
      throw new FS.ErrnoError(44);
    }
    var name = PATH.basename(path);
    var node = FS.lookupNode(parent, name);
    var errCode = FS.mayDelete(parent, name, false);
    if (errCode) {
      // According to POSIX, we should map EISDIR to EPERM, but
      // we instead do what Linux does (and we must, as we use
      // the musl linux libc).
      throw new FS.ErrnoError(errCode);
    }
    if (!parent.node_ops.unlink) {
      throw new FS.ErrnoError(63);
    }
    if (FS.isMountpoint(node)) {
      throw new FS.ErrnoError(10);
    }
    parent.node_ops.unlink(parent, name);
    FS.destroyNode(node);
  },
  readlink(path) {
    var lookup = FS.lookupPath(path);
    var link = lookup.node;
    if (!link) {
      throw new FS.ErrnoError(44);
    }
    if (!link.node_ops.readlink) {
      throw new FS.ErrnoError(28);
    }
    return link.node_ops.readlink(link);
  },
  stat(path, dontFollow) {
    var lookup = FS.lookupPath(path, {
      follow: !dontFollow
    });
    var node = lookup.node;
    var getattr = FS.checkOpExists(node.node_ops.getattr, 63);
    return getattr(node);
  },
  fstat(fd) {
    var stream = FS.getStreamChecked(fd);
    var node = stream.node;
    var getattr = stream.stream_ops.getattr;
    var arg = getattr ? stream : node;
    getattr ??= node.node_ops.getattr;
    FS.checkOpExists(getattr, 63);
    return getattr(arg);
  },
  lstat(path) {
    return FS.stat(path, true);
  },
  doChmod(stream, node, mode, dontFollow) {
    FS.doSetAttr(stream, node, {
      mode: (mode & 4095) | (node.mode & ~4095),
      ctime: Date.now(),
      dontFollow
    });
  },
  chmod(path, mode, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node;
    } else {
      node = path;
    }
    FS.doChmod(null, node, mode, dontFollow);
  },
  lchmod(path, mode) {
    FS.chmod(path, mode, true);
  },
  fchmod(fd, mode) {
    var stream = FS.getStreamChecked(fd);
    FS.doChmod(stream, stream.node, mode, false);
  },
  doChown(stream, node, dontFollow) {
    FS.doSetAttr(stream, node, {
      timestamp: Date.now(),
      dontFollow
    });
  },
  chown(path, uid, gid, dontFollow) {
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: !dontFollow
      });
      node = lookup.node;
    } else {
      node = path;
    }
    FS.doChown(null, node, dontFollow);
  },
  lchown(path, uid, gid) {
    FS.chown(path, uid, gid, true);
  },
  fchown(fd, uid, gid) {
    var stream = FS.getStreamChecked(fd);
    FS.doChown(stream, stream.node, false);
  },
  doTruncate(stream, node, len) {
    if (FS.isDir(node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!FS.isFile(node.mode)) {
      throw new FS.ErrnoError(28);
    }
    var errCode = FS.nodePermissions(node, "w");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    FS.doSetAttr(stream, node, {
      size: len,
      timestamp: Date.now()
    });
  },
  truncate(path, len) {
    if (len < 0) {
      throw new FS.ErrnoError(28);
    }
    var node;
    if (typeof path == "string") {
      var lookup = FS.lookupPath(path, {
        follow: true
      });
      node = lookup.node;
    } else {
      node = path;
    }
    FS.doTruncate(null, node, len);
  },
  ftruncate(fd, len) {
    var stream = FS.getStreamChecked(fd);
    if (len < 0 || (stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(28);
    }
    FS.doTruncate(stream, stream.node, len);
  },
  utime(path, atime, mtime) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
    setattr(node, {
      atime,
      mtime
    });
  },
  open(path, flags, mode = 438) {
    if (path === "") {
      throw new FS.ErrnoError(44);
    }
    flags = typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
    if ((flags & 64)) {
      mode = (mode & 4095) | 32768;
    } else {
      mode = 0;
    }
    var node;
    var isDirPath;
    if (typeof path == "object") {
      node = path;
    } else {
      isDirPath = path.endsWith("/");
      // noent_okay makes it so that if the final component of the path
      // doesn't exist, lookupPath returns `node: undefined`. `path` will be
      // updated to point to the target of all symlinks.
      var lookup = FS.lookupPath(path, {
        follow: !(flags & 131072),
        noent_okay: true
      });
      node = lookup.node;
      path = lookup.path;
    }
    // perhaps we need to create the node
    var created = false;
    if ((flags & 64)) {
      if (node) {
        // if O_CREAT and O_EXCL are set, error out if the node already exists
        if ((flags & 128)) {
          throw new FS.ErrnoError(20);
        }
      } else if (isDirPath) {
        throw new FS.ErrnoError(31);
      } else {
        // node doesn't exist, try to create it
        // Ignore the permission bits here to ensure we can `open` this new
        // file below. We use chmod below the apply the permissions once the
        // file is open.
        node = FS.mknod(path, mode | 511, 0);
        created = true;
      }
    }
    if (!node) {
      throw new FS.ErrnoError(44);
    }
    // can't truncate a device
    if (FS.isChrdev(node.mode)) {
      flags &= ~512;
    }
    // if asked only for a directory, then this must be one
    if ((flags & 65536) && !FS.isDir(node.mode)) {
      throw new FS.ErrnoError(54);
    }
    // check permissions, if this is not a file we just created now (it is ok to
    // create and write to a file with read-only permissions; it is read-only
    // for later use)
    if (!created) {
      var errCode = FS.mayOpen(node, flags);
      if (errCode) {
        throw new FS.ErrnoError(errCode);
      }
    }
    // do truncation if necessary
    if ((flags & 512) && !created) {
      FS.truncate(node, 0);
    }
    // we've already handled these, don't pass down to the underlying vfs
    flags &= ~(128 | 512 | 131072);
    // register the stream with the filesystem
    var stream = FS.createStream({
      node,
      path: FS.getPath(node),
      // we want the absolute path to the node
      flags,
      seekable: true,
      position: 0,
      stream_ops: node.stream_ops,
      // used by the file family libc calls (fopen, fwrite, ferror, etc.)
      ungotten: [],
      error: false
    });
    // call the new stream's open function
    if (stream.stream_ops.open) {
      stream.stream_ops.open(stream);
    }
    if (created) {
      FS.chmod(node, mode & 511);
    }
    if (Module["logReadFiles"] && !(flags & 1)) {
      if (!(path in FS.readFiles)) {
        FS.readFiles[path] = 1;
      }
    }
    return stream;
  },
  close(stream) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (stream.getdents) stream.getdents = null;
    // free readdir state
    try {
      if (stream.stream_ops.close) {
        stream.stream_ops.close(stream);
      }
    } catch (e) {
      throw e;
    } finally {
      FS.closeStream(stream.fd);
    }
    stream.fd = null;
  },
  isClosed(stream) {
    return stream.fd === null;
  },
  llseek(stream, offset, whence) {
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if (!stream.seekable || !stream.stream_ops.llseek) {
      throw new FS.ErrnoError(70);
    }
    if (whence != 0 && whence != 1 && whence != 2) {
      throw new FS.ErrnoError(28);
    }
    stream.position = stream.stream_ops.llseek(stream, offset, whence);
    stream.ungotten = [];
    return stream.position;
  },
  read(stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.read) {
      throw new FS.ErrnoError(28);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
    if (!seeking) stream.position += bytesRead;
    return bytesRead;
  },
  write(stream, buffer, offset, length, position, canOwn) {
    if (length < 0 || position < 0) {
      throw new FS.ErrnoError(28);
    }
    if (FS.isClosed(stream)) {
      throw new FS.ErrnoError(8);
    }
    if ((stream.flags & 2097155) === 0) {
      throw new FS.ErrnoError(8);
    }
    if (FS.isDir(stream.node.mode)) {
      throw new FS.ErrnoError(31);
    }
    if (!stream.stream_ops.write) {
      throw new FS.ErrnoError(28);
    }
    if (stream.seekable && stream.flags & 1024) {
      // seek to the end before writing in append mode
      FS.llseek(stream, 0, 2);
    }
    var seeking = typeof position != "undefined";
    if (!seeking) {
      position = stream.position;
    } else if (!stream.seekable) {
      throw new FS.ErrnoError(70);
    }
    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
    if (!seeking) stream.position += bytesWritten;
    return bytesWritten;
  },
  mmap(stream, length, position, prot, flags) {
    // User requests writing to file (prot & PROT_WRITE != 0).
    // Checking if we have permissions to write to the file unless
    // MAP_PRIVATE flag is set. According to POSIX spec it is possible
    // to write to file opened in read-only mode with MAP_PRIVATE flag,
    // as all modifications will be visible only in the memory of
    // the current process.
    if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
      throw new FS.ErrnoError(2);
    }
    if ((stream.flags & 2097155) === 1) {
      throw new FS.ErrnoError(2);
    }
    if (!stream.stream_ops.mmap) {
      throw new FS.ErrnoError(43);
    }
    if (!length) {
      throw new FS.ErrnoError(28);
    }
    return stream.stream_ops.mmap(stream, length, position, prot, flags);
  },
  msync(stream, buffer, offset, length, mmapFlags) {
    if (!stream.stream_ops.msync) {
      return 0;
    }
    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
  },
  ioctl(stream, cmd, arg) {
    if (!stream.stream_ops.ioctl) {
      throw new FS.ErrnoError(59);
    }
    return stream.stream_ops.ioctl(stream, cmd, arg);
  },
  readFile(path, opts = {}) {
    opts.flags = opts.flags || 0;
    opts.encoding = opts.encoding || "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      abort(`Invalid encoding type "${opts.encoding}"`);
    }
    var stream = FS.open(path, opts.flags);
    var stat = FS.stat(path);
    var length = stat.size;
    var buf = new Uint8Array(length);
    FS.read(stream, buf, 0, length, 0);
    if (opts.encoding === "utf8") {
      buf = UTF8ArrayToString(buf);
    }
    FS.close(stream);
    return buf;
  },
  writeFile(path, data, opts = {}) {
    opts.flags = opts.flags || 577;
    var stream = FS.open(path, opts.flags, opts.mode);
    if (typeof data == "string") {
      data = new Uint8Array(intArrayFromString(data, true));
    }
    if (ArrayBuffer.isView(data)) {
      FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
    } else {
      abort("Unsupported data type");
    }
    FS.close(stream);
  },
  cwd: () => FS.currentPath,
  chdir(path) {
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    if (lookup.node === null) {
      throw new FS.ErrnoError(44);
    }
    if (!FS.isDir(lookup.node.mode)) {
      throw new FS.ErrnoError(54);
    }
    var errCode = FS.nodePermissions(lookup.node, "x");
    if (errCode) {
      throw new FS.ErrnoError(errCode);
    }
    FS.currentPath = lookup.path;
  },
  createDefaultDirectories() {
    FS.mkdir("/tmp");
    FS.mkdir("/home");
    FS.mkdir("/home/web_user");
  },
  createDefaultDevices() {
    // create /dev
    FS.mkdir("/dev");
    // setup /dev/null
    FS.registerDevice(FS.makedev(1, 3), {
      read: () => 0,
      write: (stream, buffer, offset, length, pos) => length,
      llseek: () => 0
    });
    FS.mkdev("/dev/null", FS.makedev(1, 3));
    // setup /dev/tty and /dev/tty1
    // stderr needs to print output using err() rather than out()
    // so we register a second tty just for it.
    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
    FS.mkdev("/dev/tty", FS.makedev(5, 0));
    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
    // setup /dev/[u]random
    // use a buffer to avoid overhead of individual crypto calls per byte
    var randomBuffer = new Uint8Array(1024), randomLeft = 0;
    var randomByte = () => {
      if (randomLeft === 0) {
        randomFill(randomBuffer);
        randomLeft = randomBuffer.byteLength;
      }
      return randomBuffer[--randomLeft];
    };
    FS.createDevice("/dev", "random", randomByte);
    FS.createDevice("/dev", "urandom", randomByte);
    // we're not going to emulate the actual shm device,
    // just create the tmp dirs that reside in it commonly
    FS.mkdir("/dev/shm");
    FS.mkdir("/dev/shm/tmp");
  },
  createSpecialDirectories() {
    // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
    // name of the stream for fd 6 (see test_unistd_ttyname)
    FS.mkdir("/proc");
    var proc_self = FS.mkdir("/proc/self");
    FS.mkdir("/proc/self/fd");
    FS.mount({
      mount() {
        var node = FS.createNode(proc_self, "fd", 16895, 73);
        node.stream_ops = {
          llseek: MEMFS.stream_ops.llseek
        };
        node.node_ops = {
          lookup(parent, name) {
            var fd = +name;
            var stream = FS.getStreamChecked(fd);
            var ret = {
              parent: null,
              mount: {
                mountpoint: "fake"
              },
              node_ops: {
                readlink: () => stream.path
              },
              id: fd + 1
            };
            ret.parent = ret;
            // make it look like a simple root node
            return ret;
          },
          readdir() {
            return Array.from(FS.streams.entries()).filter(([k, v]) => v).map(([k, v]) => k.toString());
          }
        };
        return node;
      }
    }, {}, "/proc/self/fd");
  },
  createStandardStreams(input, output, error) {
    // TODO deprecate the old functionality of a single
    // input / output callback and that utilizes FS.createDevice
    // and instead require a unique set of stream ops
    // by default, we symlink the standard streams to the
    // default tty devices. however, if the standard streams
    // have been overwritten we create a unique device for
    // them instead.
    if (input) {
      FS.createDevice("/dev", "stdin", input);
    } else {
      FS.symlink("/dev/tty", "/dev/stdin");
    }
    if (output) {
      FS.createDevice("/dev", "stdout", null, output);
    } else {
      FS.symlink("/dev/tty", "/dev/stdout");
    }
    if (error) {
      FS.createDevice("/dev", "stderr", null, error);
    } else {
      FS.symlink("/dev/tty1", "/dev/stderr");
    }
    // open default streams for the stdin, stdout and stderr devices
    var stdin = FS.open("/dev/stdin", 0);
    var stdout = FS.open("/dev/stdout", 1);
    var stderr = FS.open("/dev/stderr", 1);
  },
  staticInit() {
    FS.nameTable = new Array(4096);
    FS.mount(MEMFS, {}, "/");
    FS.createDefaultDirectories();
    FS.createDefaultDevices();
    FS.createSpecialDirectories();
    FS.filesystems = {
      "MEMFS": MEMFS,
      "IDBFS": IDBFS
    };
  },
  init(input, output, error) {
    FS.initialized = true;
    // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
    input ??= Module["stdin"];
    output ??= Module["stdout"];
    error ??= Module["stderr"];
    FS.createStandardStreams(input, output, error);
  },
  quit() {
    FS.initialized = false;
    // force-flush all streams, so we get musl std streams printed out
    // close all of our streams
    for (var stream of FS.streams) {
      if (stream) {
        FS.close(stream);
      }
    }
  },
  findObject(path, dontResolveLastLink) {
    var ret = FS.analyzePath(path, dontResolveLastLink);
    if (!ret.exists) {
      return null;
    }
    return ret.object;
  },
  analyzePath(path, dontResolveLastLink) {
    // operate from within the context of the symlink's target
    try {
      var lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      path = lookup.path;
    } catch (e) {}
    var ret = {
      isRoot: false,
      exists: false,
      error: 0,
      name: null,
      path: null,
      object: null,
      parentExists: false,
      parentPath: null,
      parentObject: null
    };
    try {
      var lookup = FS.lookupPath(path, {
        parent: true
      });
      ret.parentExists = true;
      ret.parentPath = lookup.path;
      ret.parentObject = lookup.node;
      ret.name = PATH.basename(path);
      lookup = FS.lookupPath(path, {
        follow: !dontResolveLastLink
      });
      ret.exists = true;
      ret.path = lookup.path;
      ret.object = lookup.node;
      ret.name = lookup.node.name;
      ret.isRoot = lookup.path === "/";
    } catch (e) {
      ret.error = e.errno;
    }
    return ret;
  },
  createPath(parent, path, canRead, canWrite) {
    parent = typeof parent == "string" ? parent : FS.getPath(parent);
    var parts = path.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      try {
        FS.mkdir(current);
      } catch (e) {
        if (e.errno != 20) throw e;
      }
      parent = current;
    }
    return current;
  },
  createFile(parent, name, properties, canRead, canWrite) {
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
    var mode = FS_getMode(canRead, canWrite);
    return FS.create(path, mode);
  },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
    var path = name;
    if (parent) {
      parent = typeof parent == "string" ? parent : FS.getPath(parent);
      path = name ? PATH.join2(parent, name) : parent;
    }
    var mode = FS_getMode(canRead, canWrite);
    var node = FS.create(path, mode);
    if (data) {
      if (typeof data == "string") {
        var arr = new Array(data.length);
        for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
        data = arr;
      }
      // make sure we can write to the file
      FS.chmod(node, mode | 146);
      var stream = FS.open(node, 577);
      FS.write(stream, data, 0, data.length, 0, canOwn);
      FS.close(stream);
      FS.chmod(node, mode);
    }
  },
  createDevice(parent, name, input, output) {
    var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
    var mode = FS_getMode(!!input, !!output);
    FS.createDevice.major ??= 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    // Create a fake device that a set of stream ops to emulate
    // the old behavior.
    FS.registerDevice(dev, {
      open(stream) {
        stream.seekable = false;
      },
      close(stream) {
        // flush any pending line data
        if (output?.buffer?.length) {
          output(10);
        }
      },
      read(stream, buffer, offset, length, pos) {
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input();
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (result === undefined && bytesRead === 0) {
            throw new FS.ErrnoError(6);
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result;
        }
        if (bytesRead) {
          stream.node.atime = Date.now();
        }
        return bytesRead;
      },
      write(stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i]);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
        if (length) {
          stream.node.mtime = stream.node.ctime = Date.now();
        }
        return i;
      }
    });
    return FS.mkdev(path, mode, dev);
  },
  forceLoadFile(obj) {
    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
    if (typeof XMLHttpRequest != "undefined") {
      abort("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
    } else {
      // Command-line.
      try {
        obj.contents = readBinary(obj.url);
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
    }
  },
  createLazyFile(parent, name, url, canRead, canWrite) {
    // Lazy chunked Uint8Array (implements get and length from Uint8Array).
    // Actual getting is abstracted away for eventual reuse.
    class LazyUint8Array {
      lengthKnown=false;
      chunks=[];
      // Loaded chunks. Index is the chunk number
      get(idx) {
        if (idx > this.length - 1 || idx < 0) {
          return undefined;
        }
        var chunkOffset = idx % this.chunkSize;
        var chunkNum = (idx / this.chunkSize) | 0;
        return this.getter(chunkNum)[chunkOffset];
      }
      setDataGetter(getter) {
        this.getter = getter;
      }
      cacheLength() {
        // Find length
        var xhr = new XMLHttpRequest;
        xhr.open("HEAD", url, false);
        xhr.send(null);
        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort("Couldn't load " + url + ". Status: " + xhr.status);
        var datalength = Number(xhr.getResponseHeader("Content-length"));
        var header;
        var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
        var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
        var chunkSize = 1024 * 1024;
        // Chunk size in bytes
        if (!hasByteServing) chunkSize = datalength;
        // Function to get a range from the remote URL.
        var doXHR = (from, to) => {
          if (from > to) abort("invalid range (" + from + ", " + to + ") or no bytes requested!");
          if (to > datalength - 1) abort("only " + datalength + " bytes available! programmer error!");
          // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, false);
          if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
          // Some hints to the browser that we want binary data.
          xhr.responseType = "arraybuffer";
          if (xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
          }
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort("Couldn't load " + url + ". Status: " + xhr.status);
          if (xhr.response !== undefined) {
            return new Uint8Array(/** @type{Array<number>} */ (xhr.response || []));
          }
          return intArrayFromString(xhr.responseText || "", true);
        };
        var lazyArray = this;
        lazyArray.setDataGetter(chunkNum => {
          var start = chunkNum * chunkSize;
          var end = (chunkNum + 1) * chunkSize - 1;
          // including this byte
          end = Math.min(end, datalength - 1);
          // if datalength-1 is selected, this is the last block
          if (typeof lazyArray.chunks[chunkNum] == "undefined") {
            lazyArray.chunks[chunkNum] = doXHR(start, end);
          }
          if (typeof lazyArray.chunks[chunkNum] == "undefined") abort("doXHR failed!");
          return lazyArray.chunks[chunkNum];
        });
        if (usesGzip || !datalength) {
          // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
          chunkSize = datalength = 1;
          // this will force getter(0)/doXHR do download the whole file
          datalength = this.getter(0).length;
          chunkSize = datalength;
          out("LazyFiles on gzip forces download of the whole file when length is accessed");
        }
        this._length = datalength;
        this._chunkSize = chunkSize;
        this.lengthKnown = true;
      }
      get length() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._length;
      }
      get chunkSize() {
        if (!this.lengthKnown) {
          this.cacheLength();
        }
        return this._chunkSize;
      }
    }
    if (typeof XMLHttpRequest != "undefined") {
      if (!ENVIRONMENT_IS_WORKER) abort("Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc");
      var lazyArray = new LazyUint8Array;
      var properties = {
        isDevice: false,
        contents: lazyArray
      };
    } else {
      var properties = {
        isDevice: false,
        url
      };
    }
    var node = FS.createFile(parent, name, properties, canRead, canWrite);
    // This is a total hack, but I want to get this lazy file code out of the
    // core of MEMFS. If we want to keep this lazy file concept I feel it should
    // be its own thin LAZYFS proxying calls to MEMFS.
    if (properties.contents) {
      node.contents = properties.contents;
    } else if (properties.url) {
      node.contents = null;
      node.url = properties.url;
    }
    // Add a function that defers querying the file size until it is asked the first time.
    Object.defineProperties(node, {
      usedBytes: {
        get: function() {
          return this.contents.length;
        }
      }
    });
    // override each stream op with one that tries to force load the lazy file first
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach(key => {
      var fn = node.stream_ops[key];
      stream_ops[key] = (...args) => {
        FS.forceLoadFile(node);
        return fn(...args);
      };
    });
    function writeChunks(stream, buffer, offset, length, position) {
      var contents = stream.node.contents;
      if (position >= contents.length) return 0;
      var size = Math.min(contents.length - position, length);
      if (contents.slice) {
        // normal array
        for (var i = 0; i < size; i++) {
          buffer[offset + i] = contents[position + i];
        }
      } else {
        for (var i = 0; i < size; i++) {
          // LazyUint8Array from sync binary XHR
          buffer[offset + i] = contents.get(position + i);
        }
      }
      return size;
    }
    // use a custom read function
    stream_ops.read = (stream, buffer, offset, length, position) => {
      FS.forceLoadFile(node);
      return writeChunks(stream, buffer, offset, length, position);
    };
    // use a custom mmap function
    stream_ops.mmap = (stream, length, position, prot, flags) => {
      FS.forceLoadFile(node);
      var ptr = mmapAlloc(length);
      if (!ptr) {
        throw new FS.ErrnoError(48);
      }
      writeChunks(stream, HEAP8, ptr, length, position);
      return {
        ptr,
        allocated: true
      };
    };
    node.stream_ops = stream_ops;
    return node;
  }
};

var findLibraryFS = (libName, rpath) => {
  // If we're preloading a dynamic library, the runtime is not ready to call
  // __wasmfs_identify or __emscripten_find_dylib. So just quit out.
  // This means that DT_NEEDED for the main module and transitive dependencies
  // of it won't work with this code path. Similarly, it means that calling
  // loadDynamicLibrary in a preRun hook can't use this code path.
  if (!runtimeInitialized) {
    return undefined;
  }
  if (PATH.isAbs(libName)) {
    try {
      FS.lookupPath(libName);
      return libName;
    } catch (e) {
      return undefined;
    }
  }
  var rpathResolved = (rpath?.paths || []).map(p => replaceORIGIN(rpath?.parentLibPath, p));
  return withStackSave(() => {
    // In dylink.c we use: `char buf[2*NAME_MAX+2];` and NAME_MAX is 255.
    // So we use the same size here.
    var bufSize = 2 * 255 + 2;
    var buf = stackAlloc(bufSize);
    var rpathC = stringToUTF8OnStack(rpathResolved.join(":"));
    var libNameC = stringToUTF8OnStack(libName);
    var resLibNameC = __emscripten_find_dylib(buf, rpathC, libNameC, bufSize);
    return resLibNameC ? UTF8ToString(resLibNameC) : undefined;
  });
};

/**
       * @param {number=} handle
       * @param {Object=} localScope
       */ function loadDynamicLibrary(libName, flags = {
  global: true,
  nodelete: true
}, localScope, handle) {
  // when loadDynamicLibrary did not have flags, libraries were loaded
  // globally & permanently
  var dso = LDSO.loadedLibsByName[libName];
  if (dso) {
    // the library is being loaded or has been loaded already.
    if (!flags.global) {
      if (localScope) {
        Object.assign(localScope, dso.exports);
      }
    } else if (!dso.global) {
      // The library was previously loaded only locally but not
      // we have a request with global=true.
      dso.global = true;
      mergeLibSymbols(dso.exports, libName);
    }
    // same for "nodelete"
    if (flags.nodelete && dso.refcount !== Infinity) {
      dso.refcount = Infinity;
    }
    dso.refcount++;
    if (handle) {
      LDSO.loadedLibsByHandle[handle] = dso;
    }
    return flags.loadAsync ? Promise.resolve(true) : true;
  }
  // allocate new DSO
  dso = newDSO(libName, handle, "loading");
  dso.refcount = flags.nodelete ? Infinity : 1;
  dso.global = flags.global;
  // libName -> libData
  function loadLibData() {
    // for wasm, we can use fetch for async, but for fs mode we can only imitate it
    if (handle) {
      var data = HEAPU32[(((handle) + (28)) >>> 2) >>> 0];
      var dataSize = HEAPU32[(((handle) + (32)) >>> 2) >>> 0];
      if (data && dataSize) {
        var libData = HEAP8.slice(data, data + dataSize);
        return flags.loadAsync ? Promise.resolve(libData) : libData;
      }
    }
    var f = findLibraryFS(libName, flags.rpath);
    if (f) {
      var libData = FS.readFile(f, {
        encoding: "binary"
      });
      return flags.loadAsync ? Promise.resolve(libData) : libData;
    }
    var libFile = locateFile(libName);
    if (flags.loadAsync) {
      return asyncLoad(libFile);
    }
    // load the binary synchronously
    if (!readBinary) {
      throw new Error(`${libFile}: file not found, and synchronous loading of external files is not available`);
    }
    return readBinary(libFile);
  }
  // libName -> exports
  function getExports() {
    // lookup preloaded cache first
    var preloaded = preloadedWasm[libName];
    if (preloaded) {
      return flags.loadAsync ? Promise.resolve(preloaded) : preloaded;
    }
    // module not preloaded - load lib data and create new module from it
    if (flags.loadAsync) {
      return loadLibData().then(libData => loadWebAssemblyModule(libData, flags, libName, localScope, handle));
    }
    return loadWebAssemblyModule(loadLibData(), flags, libName, localScope, handle);
  }
  // module for lib is loaded - update the dso & global namespace
  function moduleLoaded(exports) {
    if (dso.global) {
      mergeLibSymbols(exports, libName);
    } else if (localScope) {
      Object.assign(localScope, exports);
    }
    dso.exports = exports;
  }
  if (flags.loadAsync) {
    return getExports().then(exports => {
      moduleLoaded(exports);
      return true;
    });
  }
  moduleLoaded(getExports());
  return true;
}

var reportUndefinedSymbols = () => {
  for (var [symName, entry] of Object.entries(GOT)) {
    if (entry.value == 0) {
      var value = resolveGlobalSymbol(symName, true).sym;
      if (!value && !entry.required) {
        // Ignore undefined symbols that are imported as weak.
        continue;
      }
      if (typeof value == "function") {
        /** @suppress {checkTypes} */ entry.value = addFunction(value, value.sig);
      } else if (typeof value == "number") {
        entry.value = value;
      } else {
        throw new Error(`bad export type for '${symName}': ${typeof value}`);
      }
    }
  }
};

var loadDylibs = async () => {
  if (!dynamicLibraries.length) {
    reportUndefinedSymbols();
    return;
  }
  addRunDependency("loadDylibs");
  // Load binaries asynchronously
  for (var lib of dynamicLibraries) {
    await loadDynamicLibrary(lib, {
      loadAsync: true,
      global: true,
      nodelete: true,
      allowUndefined: true
    });
  }
  // we got them all, wonderful
  reportUndefinedSymbols();
  removeRunDependency("loadDylibs");
};

var noExitRuntime = true;

/**
     * @param {number} ptr
     * @param {number} value
     * @param {string} type
     */ function setValue(ptr, value, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    HEAP8[ptr >>> 0] = value;
    break;

   case "i8":
    HEAP8[ptr >>> 0] = value;
    break;

   case "i16":
    HEAP16[((ptr) >>> 1) >>> 0] = value;
    break;

   case "i32":
    HEAP32[((ptr) >>> 2) >>> 0] = value;
    break;

   case "i64":
    HEAP64[((ptr) >>> 3) >>> 0] = BigInt(value);
    break;

   case "float":
    HEAPF32[((ptr) >>> 2) >>> 0] = value;
    break;

   case "double":
    HEAPF64[((ptr) >>> 3) >>> 0] = value;
    break;

   case "*":
    HEAPU32[((ptr) >>> 2) >>> 0] = value;
    break;

   default:
    abort(`invalid type for setValue: ${type}`);
  }
}

var INT53_MAX = 9007199254740992;

var INT53_MIN = -9007199254740992;

var bigintToI53Checked = num => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);

function ___assert_fail(condition, filename, line, func) {
  condition >>>= 0;
  filename >>>= 0;
  func >>>= 0;
  return abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [ filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function" ]);
}

___assert_fail.sig = "vppip";

var ___c_longjmp = new WebAssembly.Tag({
  "parameters": [ "i32" ]
});

function ___call_sighandler(fp, sig) {
  fp >>>= 0;
  return getWasmTableEntry(fp)(sig);
}

___call_sighandler.sig = "vpi";

var ___cpp_exception = new WebAssembly.Tag({
  "parameters": [ "i32" ]
});

var ___memory_base = new WebAssembly.Global({
  "value": "i32",
  "mutable": false
}, 1024);

var ___stack_high = 9423984;

var ___stack_low = 1035376;

var ___stack_pointer = new WebAssembly.Global({
  "value": "i32",
  "mutable": true
}, 9423984);

var SYSCALLS = {
  DEFAULT_POLLMASK: 5,
  calculateAt(dirfd, path, allowEmpty) {
    if (PATH.isAbs(path)) {
      return path;
    }
    // relative path
    var dir;
    if (dirfd === -100) {
      dir = FS.cwd();
    } else {
      var dirstream = SYSCALLS.getStreamFromFD(dirfd);
      dir = dirstream.path;
    }
    if (path.length == 0) {
      if (!allowEmpty) {
        throw new FS.ErrnoError(44);
      }
      return dir;
    }
    return dir + "/" + path;
  },
  writeStat(buf, stat) {
    HEAPU32[((buf) >>> 2) >>> 0] = stat.dev;
    HEAPU32[(((buf) + (4)) >>> 2) >>> 0] = stat.mode;
    HEAPU32[(((buf) + (8)) >>> 2) >>> 0] = stat.nlink;
    HEAPU32[(((buf) + (12)) >>> 2) >>> 0] = stat.uid;
    HEAPU32[(((buf) + (16)) >>> 2) >>> 0] = stat.gid;
    HEAPU32[(((buf) + (20)) >>> 2) >>> 0] = stat.rdev;
    HEAP64[(((buf) + (24)) >>> 3) >>> 0] = BigInt(stat.size);
    HEAP32[(((buf) + (32)) >>> 2) >>> 0] = 4096;
    HEAP32[(((buf) + (36)) >>> 2) >>> 0] = stat.blocks;
    var atime = stat.atime.getTime();
    var mtime = stat.mtime.getTime();
    var ctime = stat.ctime.getTime();
    HEAP64[(((buf) + (40)) >>> 3) >>> 0] = BigInt(Math.floor(atime / 1e3));
    HEAPU32[(((buf) + (48)) >>> 2) >>> 0] = (atime % 1e3) * 1e3 * 1e3;
    HEAP64[(((buf) + (56)) >>> 3) >>> 0] = BigInt(Math.floor(mtime / 1e3));
    HEAPU32[(((buf) + (64)) >>> 2) >>> 0] = (mtime % 1e3) * 1e3 * 1e3;
    HEAP64[(((buf) + (72)) >>> 3) >>> 0] = BigInt(Math.floor(ctime / 1e3));
    HEAPU32[(((buf) + (80)) >>> 2) >>> 0] = (ctime % 1e3) * 1e3 * 1e3;
    HEAP64[(((buf) + (88)) >>> 3) >>> 0] = BigInt(stat.ino);
    return 0;
  },
  writeStatFs(buf, stats) {
    HEAPU32[(((buf) + (4)) >>> 2) >>> 0] = stats.bsize;
    HEAPU32[(((buf) + (60)) >>> 2) >>> 0] = stats.bsize;
    HEAP64[(((buf) + (8)) >>> 3) >>> 0] = BigInt(stats.blocks);
    HEAP64[(((buf) + (16)) >>> 3) >>> 0] = BigInt(stats.bfree);
    HEAP64[(((buf) + (24)) >>> 3) >>> 0] = BigInt(stats.bavail);
    HEAP64[(((buf) + (32)) >>> 3) >>> 0] = BigInt(stats.files);
    HEAP64[(((buf) + (40)) >>> 3) >>> 0] = BigInt(stats.ffree);
    HEAPU32[(((buf) + (48)) >>> 2) >>> 0] = stats.fsid;
    HEAPU32[(((buf) + (64)) >>> 2) >>> 0] = stats.flags;
    // ST_NOSUID
    HEAPU32[(((buf) + (56)) >>> 2) >>> 0] = stats.namelen;
  },
  doMsync(addr, stream, len, flags, offset) {
    if (!FS.isFile(stream.node.mode)) {
      throw new FS.ErrnoError(43);
    }
    if (flags & 2) {
      // MAP_PRIVATE calls need not to be synced back to underlying fs
      return 0;
    }
    var buffer = HEAPU8.slice(addr, addr + len);
    FS.msync(stream, buffer, offset, len, flags);
  },
  getStreamFromFD(fd) {
    var stream = FS.getStreamChecked(fd);
    return stream;
  },
  varargs: undefined,
  getStr(ptr) {
    var ret = UTF8ToString(ptr);
    return ret;
  }
};

var ___syscall__newselect = function(nfds, readfds, writefds, exceptfds, timeout) {
  readfds >>>= 0;
  writefds >>>= 0;
  exceptfds >>>= 0;
  timeout >>>= 0;
  try {
    // readfds are supported,
    // writefds checks socket open status
    // exceptfds are supported, although on web, such exceptional conditions never arise in web sockets
    //                          and so the exceptfds list will always return empty.
    // timeout is supported, although on SOCKFS and PIPEFS these are ignored and always treated as 0 - fully async
    var total = 0;
    var srcReadLow = (readfds ? HEAP32[((readfds) >>> 2) >>> 0] : 0), srcReadHigh = (readfds ? HEAP32[(((readfds) + (4)) >>> 2) >>> 0] : 0);
    var srcWriteLow = (writefds ? HEAP32[((writefds) >>> 2) >>> 0] : 0), srcWriteHigh = (writefds ? HEAP32[(((writefds) + (4)) >>> 2) >>> 0] : 0);
    var srcExceptLow = (exceptfds ? HEAP32[((exceptfds) >>> 2) >>> 0] : 0), srcExceptHigh = (exceptfds ? HEAP32[(((exceptfds) + (4)) >>> 2) >>> 0] : 0);
    var dstReadLow = 0, dstReadHigh = 0;
    var dstWriteLow = 0, dstWriteHigh = 0;
    var dstExceptLow = 0, dstExceptHigh = 0;
    var allLow = (readfds ? HEAP32[((readfds) >>> 2) >>> 0] : 0) | (writefds ? HEAP32[((writefds) >>> 2) >>> 0] : 0) | (exceptfds ? HEAP32[((exceptfds) >>> 2) >>> 0] : 0);
    var allHigh = (readfds ? HEAP32[(((readfds) + (4)) >>> 2) >>> 0] : 0) | (writefds ? HEAP32[(((writefds) + (4)) >>> 2) >>> 0] : 0) | (exceptfds ? HEAP32[(((exceptfds) + (4)) >>> 2) >>> 0] : 0);
    var check = (fd, low, high, val) => fd < 32 ? (low & val) : (high & val);
    for (var fd = 0; fd < nfds; fd++) {
      var mask = 1 << (fd % 32);
      if (!(check(fd, allLow, allHigh, mask))) {
        continue;
      }
      var stream = SYSCALLS.getStreamFromFD(fd);
      var flags = SYSCALLS.DEFAULT_POLLMASK;
      if (stream.stream_ops.poll) {
        var timeoutInMillis = -1;
        if (timeout) {
          // select(2) is declared to accept "struct timeval { time_t tv_sec; suseconds_t tv_usec; }".
          // However, musl passes the two values to the syscall as an array of long values.
          // Note that sizeof(time_t) != sizeof(long) in wasm32. The former is 8, while the latter is 4.
          // This means using "C_STRUCTS.timeval.tv_usec" leads to a wrong offset.
          // So, instead, we use POINTER_SIZE.
          var tv_sec = (readfds ? HEAP32[((timeout) >>> 2) >>> 0] : 0), tv_usec = (readfds ? HEAP32[(((timeout) + (4)) >>> 2) >>> 0] : 0);
          timeoutInMillis = (tv_sec + tv_usec / 1e6) * 1e3;
        }
        flags = stream.stream_ops.poll(stream, timeoutInMillis);
      }
      if ((flags & 1) && check(fd, srcReadLow, srcReadHigh, mask)) {
        fd < 32 ? (dstReadLow = dstReadLow | mask) : (dstReadHigh = dstReadHigh | mask);
        total++;
      }
      if ((flags & 4) && check(fd, srcWriteLow, srcWriteHigh, mask)) {
        fd < 32 ? (dstWriteLow = dstWriteLow | mask) : (dstWriteHigh = dstWriteHigh | mask);
        total++;
      }
      if ((flags & 2) && check(fd, srcExceptLow, srcExceptHigh, mask)) {
        fd < 32 ? (dstExceptLow = dstExceptLow | mask) : (dstExceptHigh = dstExceptHigh | mask);
        total++;
      }
    }
    if (readfds) {
      HEAP32[((readfds) >>> 2) >>> 0] = dstReadLow;
      HEAP32[(((readfds) + (4)) >>> 2) >>> 0] = dstReadHigh;
    }
    if (writefds) {
      HEAP32[((writefds) >>> 2) >>> 0] = dstWriteLow;
      HEAP32[(((writefds) + (4)) >>> 2) >>> 0] = dstWriteHigh;
    }
    if (exceptfds) {
      HEAP32[((exceptfds) >>> 2) >>> 0] = dstExceptLow;
      HEAP32[(((exceptfds) + (4)) >>> 2) >>> 0] = dstExceptHigh;
    }
    return total;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
};

___syscall__newselect.sig = "iipppp";

var SOCKFS = {
  websocketArgs: {},
  callbacks: {},
  on(event, callback) {
    SOCKFS.callbacks[event] = callback;
  },
  emit(event, param) {
    SOCKFS.callbacks[event]?.(param);
  },
  mount(mount) {
    // The incomming Module['websocket'] can be used for configuring 
    // configuring subprotocol/url, etc
    SOCKFS.websocketArgs = Module["websocket"] || {};
    // Add the Event registration mechanism to the exported websocket configuration
    // object so we can register network callbacks from native JavaScript too.
    // For more documentation see system/include/emscripten/emscripten.h
    (Module["websocket"] ??= {})["on"] = SOCKFS.on;
    return FS.createNode(null, "/", 16895, 0);
  },
  createSocket(family, type, protocol) {
    // Emscripten only supports AF_INET
    if (family != 2) {
      throw new FS.ErrnoError(5);
    }
    type &= ~526336;
    // Some applications may pass it; it makes no sense for a single process.
    // Emscripten only supports SOCK_STREAM and SOCK_DGRAM
    if (type != 1 && type != 2) {
      throw new FS.ErrnoError(28);
    }
    var streaming = type == 1;
    if (streaming && protocol && protocol != 6) {
      throw new FS.ErrnoError(66);
    }
    // create our internal socket structure
    var sock = {
      family,
      type,
      protocol,
      server: null,
      error: null,
      // Used in getsockopt for SOL_SOCKET/SO_ERROR test
      peers: {},
      pending: [],
      recv_queue: [],
      sock_ops: SOCKFS.websocket_sock_ops
    };
    // create the filesystem node to store the socket structure
    var name = SOCKFS.nextname();
    var node = FS.createNode(SOCKFS.root, name, 49152, 0);
    node.sock = sock;
    // and the wrapping stream that enables library functions such
    // as read and write to indirectly interact with the socket
    var stream = FS.createStream({
      path: name,
      node,
      flags: 2,
      seekable: false,
      stream_ops: SOCKFS.stream_ops
    });
    // map the new stream to the socket structure (sockets have a 1:1
    // relationship with a stream)
    sock.stream = stream;
    return sock;
  },
  getSocket(fd) {
    var stream = FS.getStream(fd);
    if (!stream || !FS.isSocket(stream.node.mode)) {
      return null;
    }
    return stream.node.sock;
  },
  stream_ops: {
    poll(stream) {
      var sock = stream.node.sock;
      return sock.sock_ops.poll(sock);
    },
    ioctl(stream, request, varargs) {
      var sock = stream.node.sock;
      return sock.sock_ops.ioctl(sock, request, varargs);
    },
    read(stream, buffer, offset, length, position) {
      var sock = stream.node.sock;
      var msg = sock.sock_ops.recvmsg(sock, length);
      if (!msg) {
        // socket is closed
        return 0;
      }
      buffer.set(msg.buffer, offset);
      return msg.buffer.length;
    },
    write(stream, buffer, offset, length, position) {
      var sock = stream.node.sock;
      return sock.sock_ops.sendmsg(sock, buffer, offset, length);
    },
    close(stream) {
      var sock = stream.node.sock;
      sock.sock_ops.close(sock);
    }
  },
  nextname() {
    if (!SOCKFS.nextname.current) {
      SOCKFS.nextname.current = 0;
    }
    return `socket[${SOCKFS.nextname.current++}]`;
  },
  websocket_sock_ops: {
    createPeer(sock, addr, port) {
      var ws;
      if (typeof addr == "object") {
        ws = addr;
        addr = null;
        port = null;
      }
      if (ws) {
        // for sockets that've already connected (e.g. we're the server)
        // we can inspect the _socket property for the address
        if (ws._socket) {
          addr = ws._socket.remoteAddress;
          port = ws._socket.remotePort;
        } else {
          var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
          if (!result) {
            throw new Error("WebSocket URL must be in the format ws(s)://address:port");
          }
          addr = result[1];
          port = parseInt(result[2], 10);
        }
      } else {
        // create the actual websocket object and connect
        try {
          // The default value is 'ws://' the replace is needed because the compiler replaces '//' comments with '#'
          // comments without checking context, so we'd end up with ws:#, the replace swaps the '#' for '//' again.
          var url = "ws://".replace("#", "//");
          // Make the WebSocket subprotocol (Sec-WebSocket-Protocol) default to binary if no configuration is set.
          var subProtocols = "binary";
          // The default value is 'binary'
          // The default WebSocket options
          var opts = undefined;
          // Fetch runtime WebSocket URL config.
          if (SOCKFS.websocketArgs["url"]) {
            url = SOCKFS.websocketArgs["url"];
          }
          // Fetch runtime WebSocket subprotocol config.
          if (SOCKFS.websocketArgs["subprotocol"]) {
            subProtocols = SOCKFS.websocketArgs["subprotocol"];
          } else if (SOCKFS.websocketArgs["subprotocol"] === null) {
            subProtocols = "null";
          }
          if (url === "ws://" || url === "wss://") {
            // Is the supplied URL config just a prefix, if so complete it.
            var parts = addr.split("/");
            url = url + parts[0] + ":" + port + "/" + parts.slice(1).join("/");
          }
          if (subProtocols !== "null") {
            // The regex trims the string (removes spaces at the beginning and end, then splits the string by
            // <any space>,<any space> into an Array. Whitespace removal is important for Websockify and ws.
            subProtocols = subProtocols.replace(/^ +| +$/g, "").split(/ *, */);
            opts = subProtocols;
          }
          // If node we use the ws library.
          var WebSocketConstructor;
          if (ENVIRONMENT_IS_NODE) {
            WebSocketConstructor = /** @type{(typeof WebSocket)} */ (require("ws"));
          } else {
            WebSocketConstructor = WebSocket;
          }
          ws = new WebSocketConstructor(url, opts);
          ws.binaryType = "arraybuffer";
        } catch (e) {
          throw new FS.ErrnoError(23);
        }
      }
      var peer = {
        addr,
        port,
        socket: ws,
        msg_send_queue: []
      };
      SOCKFS.websocket_sock_ops.addPeer(sock, peer);
      SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
      // if this is a bound dgram socket, send the port number first to allow
      // us to override the ephemeral port reported to us by remotePort on the
      // remote end.
      if (sock.type === 2 && typeof sock.sport != "undefined") {
        peer.msg_send_queue.push(new Uint8Array([ 255, 255, 255, 255, "p".charCodeAt(0), "o".charCodeAt(0), "r".charCodeAt(0), "t".charCodeAt(0), ((sock.sport & 65280) >> 8), (sock.sport & 255) ]));
      }
      return peer;
    },
    getPeer(sock, addr, port) {
      return sock.peers[addr + ":" + port];
    },
    addPeer(sock, peer) {
      sock.peers[peer.addr + ":" + peer.port] = peer;
    },
    removePeer(sock, peer) {
      delete sock.peers[peer.addr + ":" + peer.port];
    },
    handlePeerEvents(sock, peer) {
      var first = true;
      var handleOpen = function() {
        sock.connecting = false;
        SOCKFS.emit("open", sock.stream.fd);
        try {
          var queued = peer.msg_send_queue.shift();
          while (queued) {
            peer.socket.send(queued);
            queued = peer.msg_send_queue.shift();
          }
        } catch (e) {
          // not much we can do here in the way of proper error handling as we've already
          // lied and said this data was sent. shut it down.
          peer.socket.close();
        }
      };
      function handleMessage(data) {
        if (typeof data == "string") {
          var encoder = new TextEncoder;
          // should be utf-8
          data = encoder.encode(data);
        } else {
          if (data.byteLength == 0) {
            // An empty ArrayBuffer will emit a pseudo disconnect event
            // as recv/recvmsg will return zero which indicates that a socket
            // has performed a shutdown although the connection has not been disconnected yet.
            return;
          }
          data = new Uint8Array(data);
        }
        // if this is the port message, override the peer's port with it
        var wasfirst = first;
        first = false;
        if (wasfirst && data.length === 10 && data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 && data[4] === "p".charCodeAt(0) && data[5] === "o".charCodeAt(0) && data[6] === "r".charCodeAt(0) && data[7] === "t".charCodeAt(0)) {
          // update the peer's port and it's key in the peer map
          var newport = ((data[8] << 8) | data[9]);
          SOCKFS.websocket_sock_ops.removePeer(sock, peer);
          peer.port = newport;
          SOCKFS.websocket_sock_ops.addPeer(sock, peer);
          return;
        }
        sock.recv_queue.push({
          addr: peer.addr,
          port: peer.port,
          data
        });
        SOCKFS.emit("message", sock.stream.fd);
      }
      if (ENVIRONMENT_IS_NODE) {
        peer.socket.on("open", handleOpen);
        peer.socket.on("message", function(data, isBinary) {
          if (!isBinary) {
            return;
          }
          handleMessage((new Uint8Array(data)).buffer);
        });
        peer.socket.on("close", function() {
          SOCKFS.emit("close", sock.stream.fd);
        });
        peer.socket.on("error", function(error) {
          // Although the ws library may pass errors that may be more descriptive than
          // ECONNREFUSED they are not necessarily the expected error code e.g.
          // ENOTFOUND on getaddrinfo seems to be node.js specific, so using ECONNREFUSED
          // is still probably the most useful thing to do.
          sock.error = 14;
          // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
          SOCKFS.emit("error", [ sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused" ]);
        });
      } else {
        peer.socket.onopen = handleOpen;
        peer.socket.onclose = function() {
          SOCKFS.emit("close", sock.stream.fd);
        };
        peer.socket.onmessage = function peer_socket_onmessage(event) {
          handleMessage(event.data);
        };
        peer.socket.onerror = function(error) {
          // The WebSocket spec only allows a 'simple event' to be thrown on error,
          // so we only really know as much as ECONNREFUSED.
          sock.error = 14;
          // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
          SOCKFS.emit("error", [ sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused" ]);
        };
      }
    },
    poll(sock) {
      if (sock.type === 1 && sock.server) {
        // listen sockets should only say they're available for reading
        // if there are pending clients.
        return sock.pending.length ? (64 | 1) : 0;
      }
      var mask = 0;
      var dest = sock.type === 1 ? // we only care about the socket state for connection-based sockets
      SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) : null;
      if (sock.recv_queue.length || !dest || // connection-less sockets are always ready to read
      (dest && dest.socket.readyState === dest.socket.CLOSING) || (dest && dest.socket.readyState === dest.socket.CLOSED)) {
        // let recv return 0 once closed
        mask |= (64 | 1);
      }
      if (!dest || // connection-less sockets are always ready to write
      (dest && dest.socket.readyState === dest.socket.OPEN)) {
        mask |= 4;
      }
      if ((dest && dest.socket.readyState === dest.socket.CLOSING) || (dest && dest.socket.readyState === dest.socket.CLOSED)) {
        // When an non-blocking connect fails mark the socket as writable.
        // Its up to the calling code to then use getsockopt with SO_ERROR to
        // retrieve the error.
        // See https://man7.org/linux/man-pages/man2/connect.2.html
        if (sock.connecting) {
          mask |= 4;
        } else {
          mask |= 16;
        }
      }
      return mask;
    },
    ioctl(sock, request, arg) {
      switch (request) {
       case 21531:
        var bytes = 0;
        if (sock.recv_queue.length) {
          bytes = sock.recv_queue[0].data.length;
        }
        HEAP32[((arg) >>> 2) >>> 0] = bytes;
        return 0;

       case 21537:
        var on = HEAP32[((arg) >>> 2) >>> 0];
        if (on) {
          sock.stream.flags |= 2048;
        } else {
          sock.stream.flags &= ~2048;
        }
        return 0;

       default:
        return 28;
      }
    },
    close(sock) {
      // if we've spawned a listen server, close it
      if (sock.server) {
        try {
          sock.server.close();
        } catch (e) {}
        sock.server = null;
      }
      // close any peer connections
      for (var peer of Object.values(sock.peers)) {
        try {
          peer.socket.close();
        } catch (e) {}
        SOCKFS.websocket_sock_ops.removePeer(sock, peer);
      }
      return 0;
    },
    bind(sock, addr, port) {
      if (typeof sock.saddr != "undefined" || typeof sock.sport != "undefined") {
        throw new FS.ErrnoError(28);
      }
      sock.saddr = addr;
      sock.sport = port;
      // in order to emulate dgram sockets, we need to launch a listen server when
      // binding on a connection-less socket
      // note: this is only required on the server side
      if (sock.type === 2) {
        // close the existing server if it exists
        if (sock.server) {
          sock.server.close();
          sock.server = null;
        }
        // swallow error operation not supported error that occurs when binding in the
        // browser where this isn't supported
        try {
          sock.sock_ops.listen(sock, 0);
        } catch (e) {
          if (!(e.name === "ErrnoError")) throw e;
          if (e.errno !== 138) throw e;
        }
      }
    },
    connect(sock, addr, port) {
      if (sock.server) {
        throw new FS.ErrnoError(138);
      }
      // TODO autobind
      // if (!sock.addr && sock.type == 2) {
      // }
      // early out if we're already connected / in the middle of connecting
      if (typeof sock.daddr != "undefined" && typeof sock.dport != "undefined") {
        var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
        if (dest) {
          if (dest.socket.readyState === dest.socket.CONNECTING) {
            throw new FS.ErrnoError(7);
          } else {
            throw new FS.ErrnoError(30);
          }
        }
      }
      // add the socket to our peer list and set our
      // destination address / port to match
      var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
      sock.daddr = peer.addr;
      sock.dport = peer.port;
      // because we cannot synchronously block to wait for the WebSocket
      // connection to complete, we return here pretending that the connection
      // was a success.
      sock.connecting = true;
    },
    listen(sock, backlog) {
      if (!ENVIRONMENT_IS_NODE) {
        throw new FS.ErrnoError(138);
      }
      if (sock.server) {
        throw new FS.ErrnoError(28);
      }
      var WebSocketServer = require("ws").Server;
      var host = sock.saddr;
      sock.server = new WebSocketServer({
        host,
        port: sock.sport
      });
      SOCKFS.emit("listen", sock.stream.fd);
      // Send Event with listen fd.
      sock.server.on("connection", function(ws) {
        if (sock.type === 1) {
          var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
          // create a peer on the new socket
          var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
          newsock.daddr = peer.addr;
          newsock.dport = peer.port;
          // push to queue for accept to pick up
          sock.pending.push(newsock);
          SOCKFS.emit("connection", newsock.stream.fd);
        } else {
          // create a peer on the listen socket so calling sendto
          // with the listen socket and an address will resolve
          // to the correct client
          SOCKFS.websocket_sock_ops.createPeer(sock, ws);
          SOCKFS.emit("connection", sock.stream.fd);
        }
      });
      sock.server.on("close", function() {
        SOCKFS.emit("close", sock.stream.fd);
        sock.server = null;
      });
      sock.server.on("error", function(error) {
        // Although the ws library may pass errors that may be more descriptive than
        // ECONNREFUSED they are not necessarily the expected error code e.g.
        // ENOTFOUND on getaddrinfo seems to be node.js specific, so using EHOSTUNREACH
        // is still probably the most useful thing to do. This error shouldn't
        // occur in a well written app as errors should get trapped in the compiled
        // app's own getaddrinfo call.
        sock.error = 23;
        // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
        SOCKFS.emit("error", [ sock.stream.fd, sock.error, "EHOSTUNREACH: Host is unreachable" ]);
      });
    },
    accept(listensock) {
      if (!listensock.server || !listensock.pending.length) {
        throw new FS.ErrnoError(28);
      }
      var newsock = listensock.pending.shift();
      newsock.stream.flags = listensock.stream.flags;
      return newsock;
    },
    getname(sock, peer) {
      var addr, port;
      if (peer) {
        if (sock.daddr === undefined || sock.dport === undefined) {
          throw new FS.ErrnoError(53);
        }
        addr = sock.daddr;
        port = sock.dport;
      } else {
        // TODO saddr and sport will be set for bind()'d UDP sockets, but what
        // should we be returning for TCP sockets that've been connect()'d?
        addr = sock.saddr || 0;
        port = sock.sport || 0;
      }
      return {
        addr,
        port
      };
    },
    sendmsg(sock, buffer, offset, length, addr, port) {
      if (sock.type === 2) {
        // connection-less sockets will honor the message address,
        // and otherwise fall back to the bound destination address
        if (addr === undefined || port === undefined) {
          addr = sock.daddr;
          port = sock.dport;
        }
        // if there was no address to fall back to, error out
        if (addr === undefined || port === undefined) {
          throw new FS.ErrnoError(17);
        }
      } else {
        // connection-based sockets will only use the bound
        addr = sock.daddr;
        port = sock.dport;
      }
      // find the peer for the destination address
      var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
      // early out if not connected with a connection-based socket
      if (sock.type === 1) {
        if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
          throw new FS.ErrnoError(53);
        }
      }
      // create a copy of the incoming data to send, as the WebSocket API
      // doesn't work entirely with an ArrayBufferView, it'll just send
      // the entire underlying buffer
      if (ArrayBuffer.isView(buffer)) {
        offset += buffer.byteOffset;
        buffer = buffer.buffer;
      }
      var data = buffer.slice(offset, offset + length);
      // if we don't have a cached connectionless UDP datagram connection, or
      // the TCP socket is still connecting, queue the message to be sent upon
      // connect, and lie, saying the data was sent now.
      if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
        // if we're not connected, open a new connection
        if (sock.type === 2) {
          if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
            dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
          }
        }
        dest.msg_send_queue.push(data);
        return length;
      }
      try {
        // send the actual data
        dest.socket.send(data);
        return length;
      } catch (e) {
        throw new FS.ErrnoError(28);
      }
    },
    recvmsg(sock, length) {
      // http://pubs.opengroup.org/onlinepubs/7908799/xns/recvmsg.html
      if (sock.type === 1 && sock.server) {
        // tcp servers should not be recv()'ing on the listen socket
        throw new FS.ErrnoError(53);
      }
      var queued = sock.recv_queue.shift();
      if (!queued) {
        if (sock.type === 1) {
          var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
          if (!dest) {
            // if we have a destination address but are not connected, error out
            throw new FS.ErrnoError(53);
          }
          if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
            // return null if the socket has closed
            return null;
          }
          // else, our socket is in a valid state but truly has nothing available
          throw new FS.ErrnoError(6);
        }
        throw new FS.ErrnoError(6);
      }
      // queued.data will be an ArrayBuffer if it's unadulterated, but if it's
      // requeued TCP data it'll be an ArrayBufferView
      var queuedLength = queued.data.byteLength || queued.data.length;
      var queuedOffset = queued.data.byteOffset || 0;
      var queuedBuffer = queued.data.buffer || queued.data;
      var bytesRead = Math.min(length, queuedLength);
      var res = {
        buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
        addr: queued.addr,
        port: queued.port
      };
      // push back any unread data for TCP connections
      if (sock.type === 1 && bytesRead < queuedLength) {
        var bytesRemaining = queuedLength - bytesRead;
        queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
        sock.recv_queue.unshift(queued);
      }
      return res;
    }
  }
};

var getSocketFromFD = fd => {
  var socket = SOCKFS.getSocket(fd);
  if (!socket) throw new FS.ErrnoError(8);
  return socket;
};

var inetPton4 = str => {
  var b = str.split(".");
  for (var i = 0; i < 4; i++) {
    var tmp = Number(b[i]);
    if (isNaN(tmp)) return null;
    b[i] = tmp;
  }
  return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
};

var inetPton6 = str => {
  var words;
  var w, offset, z;
  /* http://home.deds.nl/~aeron/regex/ */ var valid6regx = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
  var parts = [];
  if (!valid6regx.test(str)) {
    return null;
  }
  if (str === "::") {
    return [ 0, 0, 0, 0, 0, 0, 0, 0 ];
  }
  // Z placeholder to keep track of zeros when splitting the string on ":"
  if (str.startsWith("::")) {
    str = str.replace("::", "Z:");
  } else {
    str = str.replace("::", ":Z:");
  }
  if (str.indexOf(".") > 0) {
    // parse IPv4 embedded stress
    str = str.replace(new RegExp("[.]", "g"), ":");
    words = str.split(":");
    words[words.length - 4] = Number(words[words.length - 4]) + Number(words[words.length - 3]) * 256;
    words[words.length - 3] = Number(words[words.length - 2]) + Number(words[words.length - 1]) * 256;
    words = words.slice(0, words.length - 2);
  } else {
    words = str.split(":");
  }
  offset = 0;
  z = 0;
  for (w = 0; w < words.length; w++) {
    if (typeof words[w] == "string") {
      if (words[w] === "Z") {
        // compressed zeros - write appropriate number of zero words
        for (z = 0; z < (8 - words.length + 1); z++) {
          parts[w + z] = 0;
        }
        offset = z - 1;
      } else {
        // parse hex to field to 16-bit value and write it in network byte-order
        parts[w + offset] = _htons(parseInt(words[w], 16));
      }
    } else {
      // parsed IPv4 words
      parts[w + offset] = words[w];
    }
  }
  return [ (parts[1] << 16) | parts[0], (parts[3] << 16) | parts[2], (parts[5] << 16) | parts[4], (parts[7] << 16) | parts[6] ];
};

/** @param {number=} addrlen */ var writeSockaddr = (sa, family, addr, port, addrlen) => {
  switch (family) {
   case 2:
    addr = inetPton4(addr);
    zeroMemory(sa, 16);
    if (addrlen) {
      HEAP32[((addrlen) >>> 2) >>> 0] = 16;
    }
    HEAP16[((sa) >>> 1) >>> 0] = family;
    HEAP32[(((sa) + (4)) >>> 2) >>> 0] = addr;
    HEAP16[(((sa) + (2)) >>> 1) >>> 0] = _htons(port);
    break;

   case 10:
    addr = inetPton6(addr);
    zeroMemory(sa, 28);
    if (addrlen) {
      HEAP32[((addrlen) >>> 2) >>> 0] = 28;
    }
    HEAP32[((sa) >>> 2) >>> 0] = family;
    HEAP32[(((sa) + (8)) >>> 2) >>> 0] = addr[0];
    HEAP32[(((sa) + (12)) >>> 2) >>> 0] = addr[1];
    HEAP32[(((sa) + (16)) >>> 2) >>> 0] = addr[2];
    HEAP32[(((sa) + (20)) >>> 2) >>> 0] = addr[3];
    HEAP16[(((sa) + (2)) >>> 1) >>> 0] = _htons(port);
    break;

   default:
    return 5;
  }
  return 0;
};

var DNS = {
  address_map: {
    id: 1,
    addrs: {},
    names: {}
  },
  lookup_name(name) {
    // If the name is already a valid ipv4 / ipv6 address, don't generate a fake one.
    var res = inetPton4(name);
    if (res !== null) {
      return name;
    }
    res = inetPton6(name);
    if (res !== null) {
      return name;
    }
    // See if this name is already mapped.
    var addr;
    if (DNS.address_map.addrs[name]) {
      addr = DNS.address_map.addrs[name];
    } else {
      var id = DNS.address_map.id++;
      addr = "172.29." + (id & 255) + "." + (id & 65280);
      DNS.address_map.names[addr] = name;
      DNS.address_map.addrs[name] = addr;
    }
    return addr;
  },
  lookup_addr(addr) {
    if (DNS.address_map.names[addr]) {
      return DNS.address_map.names[addr];
    }
    return null;
  }
};

function ___syscall_accept4(fd, addr, addrlen, flags, d1, d2) {
  addr >>>= 0;
  addrlen >>>= 0;
  try {
    var sock = getSocketFromFD(fd);
    var newsock = sock.sock_ops.accept(sock);
    if (addr) {
      var errno = writeSockaddr(addr, newsock.family, DNS.lookup_name(newsock.daddr), newsock.dport, addrlen);
    }
    return newsock.stream.fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_accept4.sig = "iippiii";

var inetNtop4 = addr => (addr & 255) + "." + ((addr >> 8) & 255) + "." + ((addr >> 16) & 255) + "." + ((addr >> 24) & 255);

var inetNtop6 = ints => {
  //  ref:  http://www.ietf.org/rfc/rfc2373.txt - section 2.5.4
  //  Format for IPv4 compatible and mapped  128-bit IPv6 Addresses
  //  128-bits are split into eight 16-bit words
  //  stored in network byte order (big-endian)
  //  |                80 bits               | 16 |      32 bits        |
  //  +-----------------------------------------------------------------+
  //  |               10 bytes               |  2 |      4 bytes        |
  //  +--------------------------------------+--------------------------+
  //  +               5 words                |  1 |      2 words        |
  //  +--------------------------------------+--------------------------+
  //  |0000..............................0000|0000|    IPv4 ADDRESS     | (compatible)
  //  +--------------------------------------+----+---------------------+
  //  |0000..............................0000|FFFF|    IPv4 ADDRESS     | (mapped)
  //  +--------------------------------------+----+---------------------+
  var str = "";
  var word = 0;
  var longest = 0;
  var lastzero = 0;
  var zstart = 0;
  var len = 0;
  var i = 0;
  var parts = [ ints[0] & 65535, (ints[0] >> 16), ints[1] & 65535, (ints[1] >> 16), ints[2] & 65535, (ints[2] >> 16), ints[3] & 65535, (ints[3] >> 16) ];
  // Handle IPv4-compatible, IPv4-mapped, loopback and any/unspecified addresses
  var hasipv4 = true;
  var v4part = "";
  // check if the 10 high-order bytes are all zeros (first 5 words)
  for (i = 0; i < 5; i++) {
    if (parts[i] !== 0) {
      hasipv4 = false;
      break;
    }
  }
  if (hasipv4) {
    // low-order 32-bits store an IPv4 address (bytes 13 to 16) (last 2 words)
    v4part = inetNtop4(parts[6] | (parts[7] << 16));
    // IPv4-mapped IPv6 address if 16-bit value (bytes 11 and 12) == 0xFFFF (6th word)
    if (parts[5] === -1) {
      str = "::ffff:";
      str += v4part;
      return str;
    }
    // IPv4-compatible IPv6 address if 16-bit value (bytes 11 and 12) == 0x0000 (6th word)
    if (parts[5] === 0) {
      str = "::";
      //special case IPv6 addresses
      if (v4part === "0.0.0.0") v4part = "";
      // any/unspecified address
      if (v4part === "0.0.0.1") v4part = "1";
      // loopback address
      str += v4part;
      return str;
    }
  }
  // Handle all other IPv6 addresses
  // first run to find the longest contiguous zero words
  for (word = 0; word < 8; word++) {
    if (parts[word] === 0) {
      if (word - lastzero > 1) {
        len = 0;
      }
      lastzero = word;
      len++;
    }
    if (len > longest) {
      longest = len;
      zstart = word - longest + 1;
    }
  }
  for (word = 0; word < 8; word++) {
    if (longest > 1) {
      // compress contiguous zeros - to produce "::"
      if (parts[word] === 0 && word >= zstart && word < (zstart + longest)) {
        if (word === zstart) {
          str += ":";
          if (zstart === 0) str += ":";
        }
        continue;
      }
    }
    // converts 16-bit words from big-endian to little-endian before converting to hex string
    str += Number(_ntohs(parts[word] & 65535)).toString(16);
    str += word < 7 ? ":" : "";
  }
  return str;
};

var readSockaddr = (sa, salen) => {
  // family / port offsets are common to both sockaddr_in and sockaddr_in6
  var family = HEAP16[((sa) >>> 1) >>> 0];
  var port = _ntohs(HEAPU16[(((sa) + (2)) >>> 1) >>> 0]);
  var addr;
  switch (family) {
   case 2:
    if (salen !== 16) {
      return {
        errno: 28
      };
    }
    addr = HEAP32[(((sa) + (4)) >>> 2) >>> 0];
    addr = inetNtop4(addr);
    break;

   case 10:
    if (salen !== 28) {
      return {
        errno: 28
      };
    }
    addr = [ HEAP32[(((sa) + (8)) >>> 2) >>> 0], HEAP32[(((sa) + (12)) >>> 2) >>> 0], HEAP32[(((sa) + (16)) >>> 2) >>> 0], HEAP32[(((sa) + (20)) >>> 2) >>> 0] ];
    addr = inetNtop6(addr);
    break;

   default:
    return {
      errno: 5
    };
  }
  return {
    family,
    addr,
    port
  };
};

var getSocketAddress = (addrp, addrlen) => {
  var info = readSockaddr(addrp, addrlen);
  if (info.errno) throw new FS.ErrnoError(info.errno);
  info.addr = DNS.lookup_addr(info.addr) || info.addr;
  return info;
};

function ___syscall_bind(fd, addr, addrlen, d1, d2, d3) {
  addr >>>= 0;
  addrlen >>>= 0;
  try {
    var sock = getSocketFromFD(fd);
    var info = getSocketAddress(addr, addrlen);
    sock.sock_ops.bind(sock, info.addr, info.port);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_bind.sig = "iippiii";

function ___syscall_chdir(path) {
  path >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    FS.chdir(path);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_chdir.sig = "ip";

function ___syscall_chmod(path, mode) {
  path >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    FS.chmod(path, mode);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_chmod.sig = "ipi";

function ___syscall_connect(fd, addr, addrlen, d1, d2, d3) {
  addr >>>= 0;
  addrlen >>>= 0;
  try {
    var sock = getSocketFromFD(fd);
    var info = getSocketAddress(addr, addrlen);
    sock.sock_ops.connect(sock, info.addr, info.port);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_connect.sig = "iippiii";

function ___syscall_faccessat(dirfd, path, amode, flags) {
  path >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    if (amode & ~7) {
      // need a valid mode
      return -28;
    }
    var lookup = FS.lookupPath(path, {
      follow: true
    });
    var node = lookup.node;
    if (!node) {
      return -44;
    }
    var perms = "";
    if (amode & 4) perms += "r";
    if (amode & 2) perms += "w";
    if (amode & 1) perms += "x";
    if (perms && FS.nodePermissions(node, perms)) {
      return -2;
    }
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_faccessat.sig = "iipii";

function ___syscall_fchmod(fd, mode) {
  try {
    FS.fchmod(fd, mode);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_fchmod.sig = "iii";

function ___syscall_fchown32(fd, owner, group) {
  try {
    FS.fchown(fd, owner, group);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_fchown32.sig = "iiii";

/** @suppress {duplicate } */ var syscallGetVarargI = () => {
  // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
  var ret = HEAP32[((+SYSCALLS.varargs) >>> 2) >>> 0];
  SYSCALLS.varargs += 4;
  return ret;
};

var syscallGetVarargP = syscallGetVarargI;

function ___syscall_fcntl64(fd, cmd, varargs) {
  varargs >>>= 0;
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (cmd) {
     case 0:
      {
        var arg = syscallGetVarargI();
        if (arg < 0) {
          return -28;
        }
        while (FS.streams[arg]) {
          arg++;
        }
        var newStream;
        newStream = FS.dupStream(stream, arg);
        return newStream.fd;
      }

     case 1:
     case 2:
      return 0;

     // FD_CLOEXEC makes no sense for a single process.
      case 3:
      return stream.flags;

     case 4:
      {
        var arg = syscallGetVarargI();
        stream.flags |= arg;
        return 0;
      }

     case 12:
      {
        var arg = syscallGetVarargP();
        var offset = 0;
        // We're always unlocked.
        HEAP16[(((arg) + (offset)) >>> 1) >>> 0] = 2;
        return 0;
      }

     case 13:
     case 14:
      // Pretend that the locking is successful. These are process-level locks,
      // and Emscripten programs are a single process. If we supported linking a
      // filesystem between programs, we'd need to do more here.
      // See https://github.com/emscripten-core/emscripten/issues/23697
      return 0;
    }
    return -28;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_fcntl64.sig = "iiip";

function ___syscall_fstat64(fd, buf) {
  buf >>>= 0;
  try {
    return SYSCALLS.writeStat(buf, FS.fstat(fd));
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_fstat64.sig = "iip";

function ___syscall_ftruncate64(fd, length) {
  length = bigintToI53Checked(length);
  try {
    if (isNaN(length)) return -61;
    FS.ftruncate(fd, length);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_ftruncate64.sig = "iij";

function ___syscall_getcwd(buf, size) {
  buf >>>= 0;
  size >>>= 0;
  try {
    if (size === 0) return -28;
    var cwd = FS.cwd();
    var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
    if (size < cwdLengthInBytes) return -68;
    stringToUTF8(cwd, buf, size);
    return cwdLengthInBytes;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getcwd.sig = "ipp";

function ___syscall_getdents64(fd, dirp, count) {
  dirp >>>= 0;
  count >>>= 0;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    stream.getdents ||= FS.readdir(stream.path);
    var struct_size = 280;
    var pos = 0;
    var off = FS.llseek(stream, 0, 1);
    var startIdx = Math.floor(off / struct_size);
    var endIdx = Math.min(stream.getdents.length, startIdx + Math.floor(count / struct_size));
    for (var idx = startIdx; idx < endIdx; idx++) {
      var id;
      var type;
      var name = stream.getdents[idx];
      if (name === ".") {
        id = stream.node.id;
        type = 4;
      } else if (name === "..") {
        var lookup = FS.lookupPath(stream.path, {
          parent: true
        });
        id = lookup.node.id;
        type = 4;
      } else {
        var child;
        try {
          child = FS.lookupNode(stream.node, name);
        } catch (e) {
          // If the entry is not a directory, file, or symlink, nodefs
          // lookupNode will raise EINVAL. Skip these and continue.
          if (e?.errno === 28) {
            continue;
          }
          throw e;
        }
        id = child.id;
        type = FS.isChrdev(child.mode) ? 2 : // DT_CHR, character device.
        FS.isDir(child.mode) ? 4 : // DT_DIR, directory.
        FS.isLink(child.mode) ? 10 : // DT_LNK, symbolic link.
        8;
      }
      HEAP64[((dirp + pos) >>> 3) >>> 0] = BigInt(id);
      HEAP64[(((dirp + pos) + (8)) >>> 3) >>> 0] = BigInt((idx + 1) * struct_size);
      HEAP16[(((dirp + pos) + (16)) >>> 1) >>> 0] = 280;
      HEAP8[(dirp + pos) + (18) >>> 0] = type;
      stringToUTF8(name, dirp + pos + 19, 256);
      pos += struct_size;
    }
    FS.llseek(stream, idx * struct_size, 0);
    return pos;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getdents64.sig = "iipp";

function ___syscall_getpeername(fd, addr, addrlen, d1, d2, d3) {
  addr >>>= 0;
  addrlen >>>= 0;
  try {
    var sock = getSocketFromFD(fd);
    if (!sock.daddr) {
      return -53;
    }
    var errno = writeSockaddr(addr, sock.family, DNS.lookup_name(sock.daddr), sock.dport, addrlen);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getpeername.sig = "iippiii";

function ___syscall_getsockname(fd, addr, addrlen, d1, d2, d3) {
  addr >>>= 0;
  addrlen >>>= 0;
  try {
    var sock = getSocketFromFD(fd);
    // TODO: sock.saddr should never be undefined, see TODO in websocket_sock_ops.getname
    var errno = writeSockaddr(addr, sock.family, DNS.lookup_name(sock.saddr || "0.0.0.0"), sock.sport, addrlen);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getsockname.sig = "iippiii";

function ___syscall_getsockopt(fd, level, optname, optval, optlen, d1) {
  optval >>>= 0;
  optlen >>>= 0;
  try {
    var sock = getSocketFromFD(fd);
    // Minimal getsockopt aimed at resolving https://github.com/emscripten-core/emscripten/issues/2211
    // so only supports SOL_SOCKET with SO_ERROR.
    if (level === 1) {
      if (optname === 4) {
        HEAP32[((optval) >>> 2) >>> 0] = sock.error;
        HEAP32[((optlen) >>> 2) >>> 0] = 4;
        sock.error = null;
        // Clear the error (The SO_ERROR option obtains and then clears this field).
        return 0;
      }
    }
    return -50;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_getsockopt.sig = "iiiippi";

function ___syscall_ioctl(fd, op, varargs) {
  varargs >>>= 0;
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    switch (op) {
     case 21509:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     case 21505:
      {
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tcgets) {
          var termios = stream.tty.ops.ioctl_tcgets(stream);
          var argp = syscallGetVarargP();
          HEAP32[((argp) >>> 2) >>> 0] = termios.c_iflag || 0;
          HEAP32[(((argp) + (4)) >>> 2) >>> 0] = termios.c_oflag || 0;
          HEAP32[(((argp) + (8)) >>> 2) >>> 0] = termios.c_cflag || 0;
          HEAP32[(((argp) + (12)) >>> 2) >>> 0] = termios.c_lflag || 0;
          for (var i = 0; i < 32; i++) {
            HEAP8[(argp + i) + (17) >>> 0] = termios.c_cc[i] || 0;
          }
          return 0;
        }
        return 0;
      }

     case 21510:
     case 21511:
     case 21512:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     case 21506:
     case 21507:
     case 21508:
      {
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tcsets) {
          var argp = syscallGetVarargP();
          var c_iflag = HEAP32[((argp) >>> 2) >>> 0];
          var c_oflag = HEAP32[(((argp) + (4)) >>> 2) >>> 0];
          var c_cflag = HEAP32[(((argp) + (8)) >>> 2) >>> 0];
          var c_lflag = HEAP32[(((argp) + (12)) >>> 2) >>> 0];
          var c_cc = [];
          for (var i = 0; i < 32; i++) {
            c_cc.push(HEAP8[(argp + i) + (17) >>> 0]);
          }
          return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
            c_iflag,
            c_oflag,
            c_cflag,
            c_lflag,
            c_cc
          });
        }
        return 0;
      }

     case 21519:
      {
        if (!stream.tty) return -59;
        var argp = syscallGetVarargP();
        HEAP32[((argp) >>> 2) >>> 0] = 0;
        return 0;
      }

     case 21520:
      {
        if (!stream.tty) return -59;
        return -28;
      }

     case 21537:
     case 21531:
      {
        var argp = syscallGetVarargP();
        return FS.ioctl(stream, op, argp);
      }

     case 21523:
      {
        // TODO: in theory we should write to the winsize struct that gets
        // passed in, but for now musl doesn't read anything on it
        if (!stream.tty) return -59;
        if (stream.tty.ops.ioctl_tiocgwinsz) {
          var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
          var argp = syscallGetVarargP();
          HEAP16[((argp) >>> 1) >>> 0] = winsize[0];
          HEAP16[(((argp) + (2)) >>> 1) >>> 0] = winsize[1];
        }
        return 0;
      }

     case 21524:
      {
        // TODO: technically, this ioctl call should change the window size.
        // but, since emscripten doesn't have any concept of a terminal window
        // yet, we'll just silently throw it away as we do TIOCGWINSZ
        if (!stream.tty) return -59;
        return 0;
      }

     case 21515:
      {
        if (!stream.tty) return -59;
        return 0;
      }

     default:
      return -28;
    }
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_ioctl.sig = "iiip";

function ___syscall_listen(fd, backlog) {
  try {
    var sock = getSocketFromFD(fd);
    sock.sock_ops.listen(sock, backlog);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_listen.sig = "iiiiiii";

function ___syscall_lstat64(path, buf) {
  path >>>= 0;
  buf >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    return SYSCALLS.writeStat(buf, FS.lstat(path));
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_lstat64.sig = "ipp";

function ___syscall_mkdirat(dirfd, path, mode) {
  path >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    FS.mkdir(path, mode, 0);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_mkdirat.sig = "iipi";

function ___syscall_newfstatat(dirfd, path, buf, flags) {
  path >>>= 0;
  buf >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    var nofollow = flags & 256;
    var allowEmpty = flags & 4096;
    flags = flags & (~6400);
    path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
    return SYSCALLS.writeStat(buf, nofollow ? FS.lstat(path) : FS.stat(path));
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_newfstatat.sig = "iippi";

function ___syscall_openat(dirfd, path, flags, varargs) {
  path >>>= 0;
  varargs >>>= 0;
  SYSCALLS.varargs = varargs;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    var mode = varargs ? syscallGetVarargI() : 0;
    return FS.open(path, flags, mode).fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_openat.sig = "iipip";

function ___syscall_poll(fds, nfds, timeout) {
  fds >>>= 0;
  try {
    var nonzero = 0;
    for (var i = 0; i < nfds; i++) {
      var pollfd = fds + 8 * i;
      var fd = HEAP32[((pollfd) >>> 2) >>> 0];
      var events = HEAP16[(((pollfd) + (4)) >>> 1) >>> 0];
      var mask = 32;
      var stream = FS.getStream(fd);
      if (stream) {
        mask = SYSCALLS.DEFAULT_POLLMASK;
        if (stream.stream_ops.poll) {
          mask = stream.stream_ops.poll(stream, -1);
        }
      }
      mask &= events | 8 | 16;
      if (mask) nonzero++;
      HEAP16[(((pollfd) + (6)) >>> 1) >>> 0] = mask;
    }
    return nonzero;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_poll.sig = "ipii";

function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
  path >>>= 0;
  buf >>>= 0;
  bufsize >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    if (bufsize <= 0) return -28;
    var ret = FS.readlink(path);
    var len = Math.min(bufsize, lengthBytesUTF8(ret));
    var endChar = HEAP8[buf + len >>> 0];
    stringToUTF8(ret, buf, bufsize + 1);
    // readlink is one of the rare functions that write out a C string, but does never append a null to the output buffer(!)
    // stringToUTF8() always appends a null byte, so restore the character under the null byte after the write.
    HEAP8[buf + len >>> 0] = endChar;
    return len;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_readlinkat.sig = "iippp";

function ___syscall_recvfrom(fd, buf, len, flags, addr, addrlen) {
  buf >>>= 0;
  len >>>= 0;
  addr >>>= 0;
  addrlen >>>= 0;
  try {
    var sock = getSocketFromFD(fd);
    var msg = sock.sock_ops.recvmsg(sock, len);
    if (!msg) return 0;
    // socket is closed
    if (addr) {
      var errno = writeSockaddr(addr, sock.family, DNS.lookup_name(msg.addr), msg.port, addrlen);
    }
    HEAPU8.set(msg.buffer, buf >>> 0);
    return msg.buffer.byteLength;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_recvfrom.sig = "iippipp";

function ___syscall_renameat(olddirfd, oldpath, newdirfd, newpath) {
  oldpath >>>= 0;
  newpath >>>= 0;
  try {
    oldpath = SYSCALLS.getStr(oldpath);
    newpath = SYSCALLS.getStr(newpath);
    oldpath = SYSCALLS.calculateAt(olddirfd, oldpath);
    newpath = SYSCALLS.calculateAt(newdirfd, newpath);
    FS.rename(oldpath, newpath);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_renameat.sig = "iipip";

function ___syscall_rmdir(path) {
  path >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    FS.rmdir(path);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_rmdir.sig = "ip";

function ___syscall_sendto(fd, message, length, flags, addr, addr_len) {
  message >>>= 0;
  length >>>= 0;
  addr >>>= 0;
  addr_len >>>= 0;
  try {
    var sock = getSocketFromFD(fd);
    if (!addr) {
      // send, no address provided
      return FS.write(sock.stream, HEAP8, message, length);
    }
    var dest = getSocketAddress(addr, addr_len);
    // sendto an address
    return sock.sock_ops.sendmsg(sock, HEAP8, message, length, dest.addr, dest.port);
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_sendto.sig = "iippipp";

function ___syscall_socket(domain, type, protocol) {
  try {
    var sock = SOCKFS.createSocket(domain, type, protocol);
    return sock.stream.fd;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_socket.sig = "iiiiiii";

function ___syscall_stat64(path, buf) {
  path >>>= 0;
  buf >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    return SYSCALLS.writeStat(buf, FS.stat(path));
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_stat64.sig = "ipp";

function ___syscall_symlinkat(target, dirfd, linkpath) {
  target >>>= 0;
  linkpath >>>= 0;
  try {
    target = SYSCALLS.getStr(target);
    linkpath = SYSCALLS.getStr(linkpath);
    linkpath = SYSCALLS.calculateAt(dirfd, linkpath);
    FS.symlink(target, linkpath);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_symlinkat.sig = "ipip";

function ___syscall_unlinkat(dirfd, path, flags) {
  path >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path);
    if (!flags) {
      FS.unlink(path);
    } else if (flags === 512) {
      FS.rmdir(path);
    } else {
      return -28;
    }
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_unlinkat.sig = "iipi";

var readI53FromI64 = ptr => HEAPU32[((ptr) >>> 2) >>> 0] + HEAP32[(((ptr) + (4)) >>> 2) >>> 0] * 4294967296;

function ___syscall_utimensat(dirfd, path, times, flags) {
  path >>>= 0;
  times >>>= 0;
  try {
    path = SYSCALLS.getStr(path);
    path = SYSCALLS.calculateAt(dirfd, path, true);
    var now = Date.now(), atime, mtime;
    if (!times) {
      atime = now;
      mtime = now;
    } else {
      var seconds = readI53FromI64(times);
      var nanoseconds = HEAP32[(((times) + (8)) >>> 2) >>> 0];
      if (nanoseconds == 1073741823) {
        atime = now;
      } else if (nanoseconds == 1073741822) {
        atime = null;
      } else {
        atime = (seconds * 1e3) + (nanoseconds / (1e3 * 1e3));
      }
      times += 16;
      seconds = readI53FromI64(times);
      nanoseconds = HEAP32[(((times) + (8)) >>> 2) >>> 0];
      if (nanoseconds == 1073741823) {
        mtime = now;
      } else if (nanoseconds == 1073741822) {
        mtime = null;
      } else {
        mtime = (seconds * 1e3) + (nanoseconds / (1e3 * 1e3));
      }
    }
    // null here means UTIME_OMIT was passed. If both were set to UTIME_OMIT then
    // we can skip the call completely.
    if ((mtime ?? atime) !== null) {
      FS.utime(path, atime, mtime);
    }
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

___syscall_utimensat.sig = "iippi";

var ___table_base = new WebAssembly.Global({
  "value": "i32",
  "mutable": false
}, 1);

var __abort_js = () => abort("");

__abort_js.sig = "v";

var dlSetError = msg => {
  var sp = stackSave();
  var cmsg = stringToUTF8OnStack(msg);
  ___dl_seterr(cmsg, 0);
  stackRestore(sp);
};

var dlopenInternal = (handle, jsflags) => {
  // void *dlopen(const char *file, int mode);
  // http://pubs.opengroup.org/onlinepubs/009695399/functions/dlopen.html
  var filename = UTF8ToString(handle + 36);
  var flags = HEAP32[(((handle) + (4)) >>> 2) >>> 0];
  filename = PATH.normalize(filename);
  var global = Boolean(flags & 256);
  var localScope = global ? null : {};
  // We don't care about RTLD_NOW and RTLD_LAZY.
  var combinedFlags = {
    global,
    nodelete: Boolean(flags & 4096),
    loadAsync: jsflags.loadAsync
  };
  if (jsflags.loadAsync) {
    return loadDynamicLibrary(filename, combinedFlags, localScope, handle);
  }
  try {
    return loadDynamicLibrary(filename, combinedFlags, localScope, handle);
  } catch (e) {
    dlSetError(`Could not load dynamic lib: ${filename}\n${e}`);
    return 0;
  }
};

function __dlopen_js(handle) {
  handle >>>= 0;
  return dlopenInternal(handle, {
    loadAsync: false
  });
}

__dlopen_js.sig = "pp";

function __dlsym_js(handle, symbol, symbolIndex) {
  handle >>>= 0;
  symbol >>>= 0;
  symbolIndex >>>= 0;
  // void *dlsym(void *restrict handle, const char *restrict name);
  // http://pubs.opengroup.org/onlinepubs/009695399/functions/dlsym.html
  symbol = UTF8ToString(symbol);
  var result;
  var newSymIndex;
  var lib = LDSO.loadedLibsByHandle[handle];
  newSymIndex = Object.keys(lib.exports).indexOf(symbol);
  if (newSymIndex == -1 || lib.exports[symbol].stub) {
    dlSetError(`Tried to lookup unknown symbol "${symbol}" in dynamic lib: ${lib.name}`);
    return 0;
  }
  result = lib.exports[symbol];
  if (typeof result == "function") {
    var addr = getFunctionAddress(result);
    if (addr) {
      result = addr;
    } else {
      // Insert the function into the wasm table.  If its a direct wasm
      // function the second argument will not be needed.  If its a JS
      // function we rely on the `sig` attribute being set based on the
      // `<func>__sig` specified in library JS file.
      result = addFunction(result, result.sig);
      HEAPU32[((symbolIndex) >>> 2) >>> 0] = newSymIndex;
    }
  }
  return result;
}

__dlsym_js.sig = "pppp";

function __emscripten_lookup_name(name) {
  name >>>= 0;
  // uint32_t _emscripten_lookup_name(const char *name);
  var nameString = UTF8ToString(name);
  return inetPton4(DNS.lookup_name(nameString));
}

__emscripten_lookup_name.sig = "ip";

var runtimeKeepaliveCounter = 0;

var __emscripten_runtime_keepalive_clear = () => {
  noExitRuntime = false;
  runtimeKeepaliveCounter = 0;
};

__emscripten_runtime_keepalive_clear.sig = "v";

function __gmtime_js(time, tmPtr) {
  time = bigintToI53Checked(time);
  tmPtr >>>= 0;
  var date = new Date(time * 1e3);
  HEAP32[((tmPtr) >>> 2) >>> 0] = date.getUTCSeconds();
  HEAP32[(((tmPtr) + (4)) >>> 2) >>> 0] = date.getUTCMinutes();
  HEAP32[(((tmPtr) + (8)) >>> 2) >>> 0] = date.getUTCHours();
  HEAP32[(((tmPtr) + (12)) >>> 2) >>> 0] = date.getUTCDate();
  HEAP32[(((tmPtr) + (16)) >>> 2) >>> 0] = date.getUTCMonth();
  HEAP32[(((tmPtr) + (20)) >>> 2) >>> 0] = date.getUTCFullYear() - 1900;
  HEAP32[(((tmPtr) + (24)) >>> 2) >>> 0] = date.getUTCDay();
  var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
  HEAP32[(((tmPtr) + (28)) >>> 2) >>> 0] = yday;
}

__gmtime_js.sig = "vjp";

var isLeapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

var MONTH_DAYS_LEAP_CUMULATIVE = [ 0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335 ];

var MONTH_DAYS_REGULAR_CUMULATIVE = [ 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 ];

var ydayFromDate = date => {
  var leap = isLeapYear(date.getFullYear());
  var monthDaysCumulative = (leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE);
  var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
  // -1 since it's days since Jan 1
  return yday;
};

function __localtime_js(time, tmPtr) {
  time = bigintToI53Checked(time);
  tmPtr >>>= 0;
  var date = new Date(time * 1e3);
  HEAP32[((tmPtr) >>> 2) >>> 0] = date.getSeconds();
  HEAP32[(((tmPtr) + (4)) >>> 2) >>> 0] = date.getMinutes();
  HEAP32[(((tmPtr) + (8)) >>> 2) >>> 0] = date.getHours();
  HEAP32[(((tmPtr) + (12)) >>> 2) >>> 0] = date.getDate();
  HEAP32[(((tmPtr) + (16)) >>> 2) >>> 0] = date.getMonth();
  HEAP32[(((tmPtr) + (20)) >>> 2) >>> 0] = date.getFullYear() - 1900;
  HEAP32[(((tmPtr) + (24)) >>> 2) >>> 0] = date.getDay();
  var yday = ydayFromDate(date) | 0;
  HEAP32[(((tmPtr) + (28)) >>> 2) >>> 0] = yday;
  HEAP32[(((tmPtr) + (36)) >>> 2) >>> 0] = -(date.getTimezoneOffset() * 60);
  // Attention: DST is in December in South, and some regions don't have DST at all.
  var start = new Date(date.getFullYear(), 0, 1);
  var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  var winterOffset = start.getTimezoneOffset();
  var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
  HEAP32[(((tmPtr) + (32)) >>> 2) >>> 0] = dst;
}

__localtime_js.sig = "vjp";

function __mmap_js(len, prot, flags, fd, offset, allocated, addr) {
  len >>>= 0;
  offset = bigintToI53Checked(offset);
  allocated >>>= 0;
  addr >>>= 0;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var res = FS.mmap(stream, len, offset, prot, flags);
    var ptr = res.ptr;
    HEAP32[((allocated) >>> 2) >>> 0] = res.allocated;
    HEAPU32[((addr) >>> 2) >>> 0] = ptr;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

__mmap_js.sig = "ipiiijpp";

function __munmap_js(addr, len, prot, flags, fd, offset) {
  addr >>>= 0;
  len >>>= 0;
  offset = bigintToI53Checked(offset);
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    if (prot & 2) {
      SYSCALLS.doMsync(addr, stream, len, flags, offset);
    }
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return -e.errno;
  }
}

__munmap_js.sig = "ippiiij";

var __tzset_js = function(timezone, daylight, std_name, dst_name) {
  timezone >>>= 0;
  daylight >>>= 0;
  std_name >>>= 0;
  dst_name >>>= 0;
  // TODO: Use (malleable) environment variables instead of system settings.
  var currentYear = (new Date).getFullYear();
  var winter = new Date(currentYear, 0, 1);
  var summer = new Date(currentYear, 6, 1);
  var winterOffset = winter.getTimezoneOffset();
  var summerOffset = summer.getTimezoneOffset();
  // Local standard timezone offset. Local standard time is not adjusted for
  // daylight savings.  This code uses the fact that getTimezoneOffset returns
  // a greater value during Standard Time versus Daylight Saving Time (DST).
  // Thus it determines the expected output during Standard Time, and it
  // compares whether the output of the given date the same (Standard) or less
  // (DST).
  var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
  // timezone is specified as seconds west of UTC ("The external variable
  // `timezone` shall be set to the difference, in seconds, between
  // Coordinated Universal Time (UTC) and local standard time."), the same
  // as returned by stdTimezoneOffset.
  // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
  HEAPU32[((timezone) >>> 2) >>> 0] = stdTimezoneOffset * 60;
  HEAP32[((daylight) >>> 2) >>> 0] = Number(winterOffset != summerOffset);
  var extractZone = timezoneOffset => {
    // Why inverse sign?
    // Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
    var sign = timezoneOffset >= 0 ? "-" : "+";
    var absOffset = Math.abs(timezoneOffset);
    var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
    var minutes = String(absOffset % 60).padStart(2, "0");
    return `UTC${sign}${hours}${minutes}`;
  };
  var winterName = extractZone(winterOffset);
  var summerName = extractZone(summerOffset);
  if (summerOffset < winterOffset) {
    // Northern hemisphere
    stringToUTF8(winterName, std_name, 17);
    stringToUTF8(summerName, dst_name, 17);
  } else {
    stringToUTF8(winterName, dst_name, 17);
    stringToUTF8(summerName, std_name, 17);
  }
};

__tzset_js.sig = "vpppp";

var _emscripten_get_now = () => performance.now();

_emscripten_get_now.sig = "d";

var _emscripten_date_now = () => Date.now();

_emscripten_date_now.sig = "d";

var nowIsMonotonic = 1;

var checkWasiClock = clock_id => clock_id >= 0 && clock_id <= 3;

function _clock_time_get(clk_id, ignored_precision, ptime) {
  ignored_precision = bigintToI53Checked(ignored_precision);
  ptime >>>= 0;
  if (!checkWasiClock(clk_id)) {
    return 28;
  }
  var now;
  // all wasi clocks but realtime are monotonic
  if (clk_id === 0) {
    now = _emscripten_date_now();
  } else if (nowIsMonotonic) {
    now = _emscripten_get_now();
  } else {
    return 52;
  }
  // "now" is in ms, and wasi times are in ns.
  var nsec = Math.round(now * 1e3 * 1e3);
  HEAP64[((ptime) >>> 3) >>> 0] = BigInt(nsec);
  return 0;
}

_clock_time_get.sig = "iijp";

var readEmAsmArgsArray = [];

var readEmAsmArgs = (sigPtr, buf) => {
  readEmAsmArgsArray.length = 0;
  var ch;
  // Most arguments are i32s, so shift the buffer pointer so it is a plain
  // index into HEAP32.
  while (ch = HEAPU8[sigPtr++ >>> 0]) {
    // Floats are always passed as doubles, so all types except for 'i'
    // are 8 bytes and require alignment.
    var wide = (ch != 105);
    wide &= (ch != 112);
    buf += wide && (buf % 8) ? 4 : 0;
    readEmAsmArgsArray.push(// Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
    ch == 112 ? HEAPU32[((buf) >>> 2) >>> 0] : ch == 106 ? HEAP64[((buf) >>> 3) >>> 0] : ch == 105 ? HEAP32[((buf) >>> 2) >>> 0] : HEAPF64[((buf) >>> 3) >>> 0]);
    buf += wide ? 8 : 4;
  }
  return readEmAsmArgsArray;
};

var runEmAsmFunction = (code, sigPtr, argbuf) => {
  var args = readEmAsmArgs(sigPtr, argbuf);
  return ASM_CONSTS[code](...args);
};

function _emscripten_asm_const_double(code, sigPtr, argbuf) {
  code >>>= 0;
  sigPtr >>>= 0;
  argbuf >>>= 0;
  return runEmAsmFunction(code, sigPtr, argbuf);
}

_emscripten_asm_const_double.sig = "dppp";

function _emscripten_asm_const_int(code, sigPtr, argbuf) {
  code >>>= 0;
  sigPtr >>>= 0;
  argbuf >>>= 0;
  return runEmAsmFunction(code, sigPtr, argbuf);
}

_emscripten_asm_const_int.sig = "ippp";

function _emscripten_asm_const_ptr(code, sigPtr, argbuf) {
  code >>>= 0;
  sigPtr >>>= 0;
  argbuf >>>= 0;
  return runEmAsmFunction(code, sigPtr, argbuf);
}

_emscripten_asm_const_ptr.sig = "pppp";

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var _proc_exit = code => {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
};

_proc_exit.sig = "vi";

/** @suppress {duplicate } */ /** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  _proc_exit(status);
};

var _exit = exitJS;

_exit.sig = "vi";

var _emscripten_force_exit = status => {
  __emscripten_runtime_keepalive_clear();
  _exit(status);
};

_emscripten_force_exit.sig = "vi";

var _emscripten_get_device_pixel_ratio = () => (typeof devicePixelRatio == "number" && devicePixelRatio) || 1;

_emscripten_get_device_pixel_ratio.sig = "d";

var handleException = e => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == "unwind") {
    return EXITSTATUS;
  }
  quit_(1, e);
};

var maybeExit = () => {
  if (!keepRuntimeAlive()) {
    try {
      _exit(EXITSTATUS);
    } catch (e) {
      handleException(e);
    }
  }
};

var callUserCallback = func => {
  if (ABORT) {
    return;
  }
  try {
    func();
    maybeExit();
  } catch (e) {
    handleException(e);
  }
};

function getFullscreenElement() {
  return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || document.msFullscreenElement;
}

/** @param {number=} timeout */ var safeSetTimeout = (func, timeout) => setTimeout(() => {
  callUserCallback(func);
}, timeout);

var warnOnce = text => {
  warnOnce.shown ||= {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    if (ENVIRONMENT_IS_NODE) text = "warning: " + text;
    err(text);
  }
};

var Browser = {
  useWebGL: false,
  isFullscreen: false,
  pointerLock: false,
  moduleContextCreatedCallbacks: [],
  workers: [],
  preloadedImages: {},
  preloadedAudios: {},
  getCanvas: () => Module["canvas"],
  init() {
    if (Browser.initted) return;
    Browser.initted = true;
    // Support for plugins that can process preloaded files. You can add more of these to
    // your app by creating and appending to preloadPlugins.
    // Each plugin is asked if it can handle a file based on the file's name. If it can,
    // it is given the file's raw data. When it is done, it calls a callback with the file's
    // (possibly modified) data. For example, a plugin might decompress a file, or it
    // might create some side data structure for use later (like an Image element, etc.).
    var imagePlugin = {};
    imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
      return !Module["noImageDecoding"] && /\.(jpg|jpeg|png|bmp|webp)$/i.test(name);
    };
    imagePlugin["handle"] = async function imagePlugin_handle(byteArray, name) {
      var b = new Blob([ byteArray ], {
        type: Browser.getMimetype(name)
      });
      if (b.size !== byteArray.length) {
        // Safari bug #118630
        // Safari's Blob can only take an ArrayBuffer
        b = new Blob([ (new Uint8Array(byteArray)).buffer ], {
          type: Browser.getMimetype(name)
        });
      }
      var url = URL.createObjectURL(b);
      return new Promise((resolve, reject) => {
        var img = new Image;
        img.onload = () => {
          var canvas = /** @type {!HTMLCanvasElement} */ (document.createElement("canvas"));
          canvas.width = img.width;
          canvas.height = img.height;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          Browser.preloadedImages[name] = canvas;
          URL.revokeObjectURL(url);
          resolve(byteArray);
        };
        img.onerror = event => {
          err(`Image ${url} could not be decoded`);
          reject();
        };
        img.src = url;
      });
    };
    preloadPlugins.push(imagePlugin);
    var audioPlugin = {};
    audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
      return !Module["noAudioDecoding"] && name.slice(-4) in {
        ".ogg": 1,
        ".wav": 1,
        ".mp3": 1
      };
    };
    audioPlugin["handle"] = async function audioPlugin_handle(byteArray, name) {
      return new Promise((resolve, reject) => {
        var done = false;
        function finish(audio) {
          if (done) return;
          done = true;
          Browser.preloadedAudios[name] = audio;
          resolve(byteArray);
        }
        var b = new Blob([ byteArray ], {
          type: Browser.getMimetype(name)
        });
        var url = URL.createObjectURL(b);
        // XXX we never revoke this!
        var audio = new Audio;
        audio.addEventListener("canplaythrough", () => finish(audio), false);
        // use addEventListener due to chromium bug 124926
        audio.onerror = function audio_onerror(event) {
          if (done) return;
          err(`warning: browser could not fully decode audio ${name}, trying slower base64 approach`);
          function encode64(data) {
            var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var PAD = "=";
            var ret = "";
            var leftchar = 0;
            var leftbits = 0;
            for (var i = 0; i < data.length; i++) {
              leftchar = (leftchar << 8) | data[i];
              leftbits += 8;
              while (leftbits >= 6) {
                var curr = (leftchar >> (leftbits - 6)) & 63;
                leftbits -= 6;
                ret += BASE[curr];
              }
            }
            if (leftbits == 2) {
              ret += BASE[(leftchar & 3) << 4];
              ret += PAD + PAD;
            } else if (leftbits == 4) {
              ret += BASE[(leftchar & 15) << 2];
              ret += PAD;
            }
            return ret;
          }
          audio.src = "data:audio/x-" + name.slice(-3) + ";base64," + encode64(byteArray);
          finish(audio);
        };
        audio.src = url;
        // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
        safeSetTimeout(() => {
          finish(audio);
        }, 1e4);
      });
    };
    preloadPlugins.push(audioPlugin);
    // Canvas event setup
    function pointerLockChange() {
      var canvas = Browser.getCanvas();
      Browser.pointerLock = document.pointerLockElement === canvas;
    }
    var canvas = Browser.getCanvas();
    if (canvas) {
      // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
      // Module['forcedAspectRatio'] = 4 / 3;
      document.addEventListener("pointerlockchange", pointerLockChange, false);
      if (Module["elementPointerLock"]) {
        canvas.addEventListener("click", ev => {
          if (!Browser.pointerLock && Browser.getCanvas().requestPointerLock) {
            Browser.getCanvas().requestPointerLock();
            ev.preventDefault();
          }
        }, false);
      }
    }
  },
  createContext(/** @type {HTMLCanvasElement} */ canvas, useWebGL, setInModule, webGLContextAttributes) {
    if (useWebGL && Module["ctx"] && canvas == Browser.getCanvas()) return Module["ctx"];
    // no need to recreate GL context if it's already been created for this canvas.
    var ctx;
    var contextHandle;
    if (useWebGL) {
      // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
      var contextAttributes = {
        antialias: false,
        alpha: false,
        majorVersion: (typeof WebGL2RenderingContext != "undefined") ? 2 : 1
      };
      if (webGLContextAttributes) {
        for (var attribute in webGLContextAttributes) {
          contextAttributes[attribute] = webGLContextAttributes[attribute];
        }
      }
      // This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
      // actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
      // Browser.createContext() should not even be emitted.
      if (typeof GL != "undefined") {
        contextHandle = GL.createContext(canvas, contextAttributes);
        if (contextHandle) {
          ctx = GL.getContext(contextHandle).GLctx;
        }
      }
    } else {
      ctx = canvas.getContext("2d");
    }
    if (!ctx) return null;
    if (setInModule) {
      Module["ctx"] = ctx;
      if (useWebGL) GL.makeContextCurrent(contextHandle);
      Browser.useWebGL = useWebGL;
      Browser.moduleContextCreatedCallbacks.forEach(callback => callback());
      Browser.init();
    }
    return ctx;
  },
  fullscreenHandlersInstalled: false,
  lockPointer: undefined,
  resizeCanvas: undefined,
  requestFullscreen(lockPointer, resizeCanvas) {
    Browser.lockPointer = lockPointer;
    Browser.resizeCanvas = resizeCanvas;
    if (typeof Browser.lockPointer == "undefined") Browser.lockPointer = true;
    if (typeof Browser.resizeCanvas == "undefined") Browser.resizeCanvas = false;
    var canvas = Browser.getCanvas();
    function fullscreenChange() {
      Browser.isFullscreen = false;
      var canvasContainer = canvas.parentNode;
      if (getFullscreenElement() === canvasContainer) {
        canvas.exitFullscreen = Browser.exitFullscreen;
        if (Browser.lockPointer) canvas.requestPointerLock();
        Browser.isFullscreen = true;
        if (Browser.resizeCanvas) {
          Browser.setFullscreenCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
        }
      } else {
        // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
        canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
        canvasContainer.parentNode.removeChild(canvasContainer);
        if (Browser.resizeCanvas) {
          Browser.setWindowedCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
        }
      }
      Module["onFullScreen"]?.(Browser.isFullscreen);
      Module["onFullscreen"]?.(Browser.isFullscreen);
    }
    if (!Browser.fullscreenHandlersInstalled) {
      Browser.fullscreenHandlersInstalled = true;
      document.addEventListener("fullscreenchange", fullscreenChange, false);
      document.addEventListener("mozfullscreenchange", fullscreenChange, false);
      document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
      document.addEventListener("MSFullscreenChange", fullscreenChange, false);
    }
    // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
    var canvasContainer = document.createElement("div");
    canvas.parentNode.insertBefore(canvasContainer, canvas);
    canvasContainer.appendChild(canvas);
    // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
    canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? () => canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null) || (canvasContainer["webkitRequestFullScreen"] ? () => canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]) : null);
    canvasContainer.requestFullscreen();
  },
  exitFullscreen() {
    // This is workaround for chrome. Trying to exit from fullscreen
    // not in fullscreen state will cause "TypeError: Document not active"
    // in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
    if (!Browser.isFullscreen) {
      return false;
    }
    var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || (() => {});
    CFS.apply(document, []);
    return true;
  },
  safeSetTimeout(func, timeout) {
    // Legacy function, this is used by the SDL2 port so we need to keep it
    // around at least until that is updated.
    // See https://github.com/libsdl-org/SDL/pull/6304
    return safeSetTimeout(func, timeout);
  },
  getMimetype(name) {
    return {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "bmp": "image/bmp",
      "ogg": "audio/ogg",
      "wav": "audio/wav",
      "mp3": "audio/mpeg"
    }[name.slice(name.lastIndexOf(".") + 1)];
  },
  getUserMedia(func) {
    window.getUserMedia ||= navigator["getUserMedia"] || navigator["mozGetUserMedia"];
    window.getUserMedia(func);
  },
  getMovementX(event) {
    return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
  },
  getMovementY(event) {
    return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
  },
  getMouseWheelDelta(event) {
    var delta = 0;
    switch (event.type) {
     case "DOMMouseScroll":
      // 3 lines make up a step
      delta = event.detail / 3;
      break;

     case "mousewheel":
      // 120 units make up a step
      delta = event.wheelDelta / 120;
      break;

     case "wheel":
      delta = event.deltaY;
      switch (event.deltaMode) {
       case 0:
        // DOM_DELTA_PIXEL: 100 pixels make up a step
        delta /= 100;
        break;

       case 1:
        // DOM_DELTA_LINE: 3 lines make up a step
        delta /= 3;
        break;

       case 2:
        // DOM_DELTA_PAGE: A page makes up 80 steps
        delta *= 80;
        break;

       default:
        abort("unrecognized mouse wheel delta mode: " + event.deltaMode);
      }
      break;

     default:
      abort("unrecognized mouse wheel event: " + event.type);
    }
    return delta;
  },
  mouseX: 0,
  mouseY: 0,
  mouseMovementX: 0,
  mouseMovementY: 0,
  touches: {},
  lastTouches: {},
  calculateMouseCoords(pageX, pageY) {
    // Calculate the movement based on the changes
    // in the coordinates.
    var canvas = Browser.getCanvas();
    var rect = canvas.getBoundingClientRect();
    // Neither .scrollX or .pageXOffset are defined in a spec, but
    // we prefer .scrollX because it is currently in a spec draft.
    // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
    var scrollX = ((typeof window.scrollX != "undefined") ? window.scrollX : window.pageXOffset);
    var scrollY = ((typeof window.scrollY != "undefined") ? window.scrollY : window.pageYOffset);
    var adjustedX = pageX - (scrollX + rect.left);
    var adjustedY = pageY - (scrollY + rect.top);
    // the canvas might be CSS-scaled compared to its backbuffer;
    // SDL-using content will want mouse coordinates in terms
    // of backbuffer units.
    adjustedX = adjustedX * (canvas.width / rect.width);
    adjustedY = adjustedY * (canvas.height / rect.height);
    return {
      x: adjustedX,
      y: adjustedY
    };
  },
  setMouseCoords(pageX, pageY) {
    const {x, y} = Browser.calculateMouseCoords(pageX, pageY);
    Browser.mouseMovementX = x - Browser.mouseX;
    Browser.mouseMovementY = y - Browser.mouseY;
    Browser.mouseX = x;
    Browser.mouseY = y;
  },
  calculateMouseEvent(event) {
    // event should be mousemove, mousedown or mouseup
    if (Browser.pointerLock) {
      // When the pointer is locked, calculate the coordinates
      // based on the movement of the mouse.
      // Workaround for Firefox bug 764498
      if (event.type != "mousemove" && ("mozMovementX" in event)) {
        Browser.mouseMovementX = Browser.mouseMovementY = 0;
      } else {
        Browser.mouseMovementX = Browser.getMovementX(event);
        Browser.mouseMovementY = Browser.getMovementY(event);
      }
      // add the mouse delta to the current absolute mouse position
      Browser.mouseX += Browser.mouseMovementX;
      Browser.mouseY += Browser.mouseMovementY;
    } else {
      if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
        var touch = event.touch;
        if (touch === undefined) {
          return;
        }
        var coords = Browser.calculateMouseCoords(touch.pageX, touch.pageY);
        if (event.type === "touchstart") {
          Browser.lastTouches[touch.identifier] = coords;
          Browser.touches[touch.identifier] = coords;
        } else if (event.type === "touchend" || event.type === "touchmove") {
          var last = Browser.touches[touch.identifier];
          last ||= coords;
          Browser.lastTouches[touch.identifier] = last;
          Browser.touches[touch.identifier] = coords;
        }
        return;
      }
      Browser.setMouseCoords(event.pageX, event.pageY);
    }
  },
  resizeListeners: [],
  updateResizeListeners() {
    var canvas = Browser.getCanvas();
    Browser.resizeListeners.forEach(listener => listener(canvas.width, canvas.height));
  },
  setCanvasSize(width, height, noUpdates) {
    var canvas = Browser.getCanvas();
    Browser.updateCanvasDimensions(canvas, width, height);
    if (!noUpdates) Browser.updateResizeListeners();
  },
  windowedWidth: 0,
  windowedHeight: 0,
  setFullscreenCanvasSize() {
    // check if SDL is available
    if (typeof SDL != "undefined") {
      var flags = HEAPU32[((SDL.screen) >>> 2) >>> 0];
      flags = flags | 8388608;
      // set SDL_FULLSCREEN flag
      HEAP32[((SDL.screen) >>> 2) >>> 0] = flags;
    }
    Browser.updateCanvasDimensions(Browser.getCanvas());
    Browser.updateResizeListeners();
  },
  setWindowedCanvasSize() {
    // check if SDL is available
    if (typeof SDL != "undefined") {
      var flags = HEAPU32[((SDL.screen) >>> 2) >>> 0];
      flags = flags & ~8388608;
      // clear SDL_FULLSCREEN flag
      HEAP32[((SDL.screen) >>> 2) >>> 0] = flags;
    }
    Browser.updateCanvasDimensions(Browser.getCanvas());
    Browser.updateResizeListeners();
  },
  updateCanvasDimensions(canvas, wNative, hNative) {
    if (wNative && hNative) {
      canvas.widthNative = wNative;
      canvas.heightNative = hNative;
    } else {
      wNative = canvas.widthNative;
      hNative = canvas.heightNative;
    }
    var w = wNative;
    var h = hNative;
    if (Module["forcedAspectRatio"] > 0) {
      if (w / h < Module["forcedAspectRatio"]) {
        w = Math.round(h * Module["forcedAspectRatio"]);
      } else {
        h = Math.round(w / Module["forcedAspectRatio"]);
      }
    }
    if ((getFullscreenElement() === canvas.parentNode) && (typeof screen != "undefined")) {
      var factor = Math.min(screen.width / w, screen.height / h);
      w = Math.round(w * factor);
      h = Math.round(h * factor);
    }
    if (Browser.resizeCanvas) {
      if (canvas.width != w) canvas.width = w;
      if (canvas.height != h) canvas.height = h;
      if (typeof canvas.style != "undefined") {
        canvas.style.removeProperty("width");
        canvas.style.removeProperty("height");
      }
    } else {
      if (canvas.width != wNative) canvas.width = wNative;
      if (canvas.height != hNative) canvas.height = hNative;
      if (typeof canvas.style != "undefined") {
        if (w != wNative || h != hNative) {
          canvas.style.setProperty("width", w + "px", "important");
          canvas.style.setProperty("height", h + "px", "important");
        } else {
          canvas.style.removeProperty("width");
          canvas.style.removeProperty("height");
        }
      }
    }
  }
};

function _emscripten_get_screen_size(width, height) {
  width >>>= 0;
  height >>>= 0;
  HEAP32[((width) >>> 2) >>> 0] = screen.width;
  HEAP32[((height) >>> 2) >>> 0] = screen.height;
}

_emscripten_get_screen_size.sig = "vpp";

function _emscripten_get_window_title() {
  var buflen = 256;
  if (!_emscripten_get_window_title.buffer) {
    _emscripten_get_window_title.buffer = _malloc(buflen);
  }
  stringToUTF8(document.title, _emscripten_get_window_title.buffer, buflen);
  return _emscripten_get_window_title.buffer;
}

_emscripten_get_window_title.sig = "p";

var GLctx;

var webgl_enable_ANGLE_instanced_arrays = ctx => {
  // Extension available in WebGL 1 from Firefox 26 and Google Chrome 30 onwards. Core feature in WebGL 2.
  var ext = ctx.getExtension("ANGLE_instanced_arrays");
  // Because this extension is a core function in WebGL 2, assign the extension entry points in place of
  // where the core functions will reside in WebGL 2. This way the calling code can call these without
  // having to dynamically branch depending if running against WebGL 1 or WebGL 2.
  if (ext) {
    ctx["vertexAttribDivisor"] = (index, divisor) => ext["vertexAttribDivisorANGLE"](index, divisor);
    ctx["drawArraysInstanced"] = (mode, first, count, primcount) => ext["drawArraysInstancedANGLE"](mode, first, count, primcount);
    ctx["drawElementsInstanced"] = (mode, count, type, indices, primcount) => ext["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
    return 1;
  }
};

var webgl_enable_OES_vertex_array_object = ctx => {
  // Extension available in WebGL 1 from Firefox 25 and WebKit 536.28/desktop Safari 6.0.3 onwards. Core feature in WebGL 2.
  var ext = ctx.getExtension("OES_vertex_array_object");
  if (ext) {
    ctx["createVertexArray"] = () => ext["createVertexArrayOES"]();
    ctx["deleteVertexArray"] = vao => ext["deleteVertexArrayOES"](vao);
    ctx["bindVertexArray"] = vao => ext["bindVertexArrayOES"](vao);
    ctx["isVertexArray"] = vao => ext["isVertexArrayOES"](vao);
    return 1;
  }
};

var webgl_enable_WEBGL_draw_buffers = ctx => {
  // Extension available in WebGL 1 from Firefox 28 onwards. Core feature in WebGL 2.
  var ext = ctx.getExtension("WEBGL_draw_buffers");
  if (ext) {
    ctx["drawBuffers"] = (n, bufs) => ext["drawBuffersWEBGL"](n, bufs);
    return 1;
  }
};

var webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance = ctx => // Closure is expected to be allowed to minify the '.dibvbi' property, so not accessing it quoted.
!!(ctx.dibvbi = ctx.getExtension("WEBGL_draw_instanced_base_vertex_base_instance"));

var webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance = ctx => !!(ctx.mdibvbi = ctx.getExtension("WEBGL_multi_draw_instanced_base_vertex_base_instance"));

var webgl_enable_EXT_polygon_offset_clamp = ctx => !!(ctx.extPolygonOffsetClamp = ctx.getExtension("EXT_polygon_offset_clamp"));

var webgl_enable_EXT_clip_control = ctx => !!(ctx.extClipControl = ctx.getExtension("EXT_clip_control"));

var webgl_enable_WEBGL_polygon_mode = ctx => !!(ctx.webglPolygonMode = ctx.getExtension("WEBGL_polygon_mode"));

var webgl_enable_WEBGL_multi_draw = ctx => // Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
!!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"));

var getEmscriptenSupportedExtensions = ctx => {
  // Restrict the list of advertised extensions to those that we actually
  // support.
  var supportedExtensions = [ // WebGL 1 extensions
  "ANGLE_instanced_arrays", "EXT_blend_minmax", "EXT_disjoint_timer_query", "EXT_frag_depth", "EXT_shader_texture_lod", "EXT_sRGB", "OES_element_index_uint", "OES_fbo_render_mipmap", "OES_standard_derivatives", "OES_texture_float", "OES_texture_half_float", "OES_texture_half_float_linear", "OES_vertex_array_object", "WEBGL_color_buffer_float", "WEBGL_depth_texture", "WEBGL_draw_buffers", // WebGL 2 extensions
  "EXT_color_buffer_float", "EXT_conservative_depth", "EXT_disjoint_timer_query_webgl2", "EXT_texture_norm16", "NV_shader_noperspective_interpolation", "WEBGL_clip_cull_distance", // WebGL 1 and WebGL 2 extensions
  "EXT_clip_control", "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_float_blend", "EXT_polygon_offset_clamp", "EXT_texture_compression_bptc", "EXT_texture_compression_rgtc", "EXT_texture_filter_anisotropic", "KHR_parallel_shader_compile", "OES_texture_float_linear", "WEBGL_blend_func_extended", "WEBGL_compressed_texture_astc", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_etc1", "WEBGL_compressed_texture_s3tc", "WEBGL_compressed_texture_s3tc_srgb", "WEBGL_debug_renderer_info", "WEBGL_debug_shaders", "WEBGL_lose_context", "WEBGL_multi_draw", "WEBGL_polygon_mode" ];
  // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
  return (ctx.getSupportedExtensions() || []).filter(ext => supportedExtensions.includes(ext));
};

var GL = {
  counter: 1,
  buffers: [],
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  shaders: [],
  vaos: [],
  contexts: [],
  offscreenCanvases: {},
  queries: [],
  samplers: [],
  transformFeedbacks: [],
  syncs: [],
  stringCache: {},
  stringiCache: {},
  unpackAlignment: 4,
  unpackRowLength: 0,
  recordError: errorCode => {
    if (!GL.lastError) {
      GL.lastError = errorCode;
    }
  },
  getNewId: table => {
    var ret = GL.counter++;
    for (var i = table.length; i < ret; i++) {
      table[i] = null;
    }
    return ret;
  },
  genObject: (n, buffers, createFunction, objectTable) => {
    for (var i = 0; i < n; i++) {
      var buffer = GLctx[createFunction]();
      var id = buffer && GL.getNewId(objectTable);
      if (buffer) {
        buffer.name = id;
        objectTable[id] = buffer;
      } else {
        GL.recordError(1282);
      }
      HEAP32[(((buffers) + (i * 4)) >>> 2) >>> 0] = id;
    }
  },
  getSource: (shader, count, string, length) => {
    var source = "";
    for (var i = 0; i < count; ++i) {
      var len = length ? HEAPU32[(((length) + (i * 4)) >>> 2) >>> 0] : undefined;
      source += UTF8ToString(HEAPU32[(((string) + (i * 4)) >>> 2) >>> 0], len);
    }
    return source;
  },
  createContext: (/** @type {HTMLCanvasElement} */ canvas, webGLContextAttributes) => {
    // BUG: Workaround Safari WebGL issue: After successfully acquiring WebGL
    // context on a canvas, calling .getContext() will always return that
    // context independent of which 'webgl' or 'webgl2'
    // context version was passed. See:
    //   https://bugs.webkit.org/show_bug.cgi?id=222758
    // and:
    //   https://github.com/emscripten-core/emscripten/issues/13295.
    // TODO: Once the bug is fixed and shipped in Safari, adjust the Safari
    // version field in above check.
    if (!canvas.getContextSafariWebGL2Fixed) {
      canvas.getContextSafariWebGL2Fixed = canvas.getContext;
      /** @type {function(this:HTMLCanvasElement, string, (Object|null)=): (Object|null)} */ function fixedGetContext(ver, attrs) {
        var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs);
        return ((ver == "webgl") == (gl instanceof WebGLRenderingContext)) ? gl : null;
      }
      canvas.getContext = fixedGetContext;
    }
    var ctx = (webGLContextAttributes.majorVersion > 1) ? canvas.getContext("webgl2", webGLContextAttributes) : canvas.getContext("webgl", webGLContextAttributes);
    if (!ctx) return 0;
    var handle = GL.registerContext(ctx, webGLContextAttributes);
    return handle;
  },
  registerContext: (ctx, webGLContextAttributes) => {
    // without pthreads a context is just an integer ID
    var handle = GL.getNewId(GL.contexts);
    var context = {
      handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    };
    // Store the created context object so that we can access the context
    // given a canvas without having to pass the parameters again.
    if (ctx.canvas) ctx.canvas.GLctxObject = context;
    GL.contexts[handle] = context;
    if (typeof webGLContextAttributes.enableExtensionsByDefault == "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
      GL.initExtensions(context);
    }
    return handle;
  },
  makeContextCurrent: contextHandle => {
    // Active Emscripten GL layer context object.
    GL.currentContext = GL.contexts[contextHandle];
    // Active WebGL context object.
    Module["ctx"] = GLctx = GL.currentContext?.GLctx;
    return !(contextHandle && !GLctx);
  },
  getContext: contextHandle => GL.contexts[contextHandle],
  deleteContext: contextHandle => {
    if (GL.currentContext === GL.contexts[contextHandle]) {
      GL.currentContext = null;
    }
    if (typeof JSEvents == "object") {
      // Release all JS event handlers on the DOM element that the GL context is
      // associated with since the context is now deleted.
      JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
    }
    // Make sure the canvas object no longer refers to the context object so
    // there are no GC surprises.
    if (GL.contexts[contextHandle]?.GLctx.canvas) {
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
    }
    GL.contexts[contextHandle] = null;
  },
  initExtensions: context => {
    // If this function is called without a specific context object, init the
    // extensions of the currently active context.
    context ||= GL.currentContext;
    if (context.initExtensionsDone) return;
    context.initExtensionsDone = true;
    var GLctx = context.GLctx;
    // Detect the presence of a few extensions manually, ction GL interop
    // layer itself will need to know if they exist.
    // Extensions that are available in both WebGL 1 and WebGL 2
    webgl_enable_WEBGL_multi_draw(GLctx);
    webgl_enable_EXT_polygon_offset_clamp(GLctx);
    webgl_enable_EXT_clip_control(GLctx);
    webgl_enable_WEBGL_polygon_mode(GLctx);
    // Extensions that are only available in WebGL 1 (the calls will be no-ops
    // if called on a WebGL 2 context active)
    webgl_enable_ANGLE_instanced_arrays(GLctx);
    webgl_enable_OES_vertex_array_object(GLctx);
    webgl_enable_WEBGL_draw_buffers(GLctx);
    // Extensions that are available from WebGL >= 2 (no-op if called on a WebGL 1 context active)
    webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(GLctx);
    webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(GLctx);
    // On WebGL 2, EXT_disjoint_timer_query is replaced with an alternative
    // that's based on core APIs, and exposes only the queryCounterEXT()
    // entrypoint.
    if (context.version >= 2) {
      GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query_webgl2");
    }
    // However, Firefox exposes the WebGL 1 version on WebGL 2 as well and
    // thus we look for the WebGL 1 version again if the WebGL 2 version
    // isn't present. https://bugzilla.mozilla.org/show_bug.cgi?id=1328882
    if (context.version < 2 || !GLctx.disjointTimerQueryExt) {
      GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
    }
    getEmscriptenSupportedExtensions(GLctx).forEach(ext => {
      // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders
      // are not enabled by default.
      if (!ext.includes("lose_context") && !ext.includes("debug")) {
        // Call .getExtension() to enable that extension permanently.
        GLctx.getExtension(ext);
      }
    });
  }
};

function _emscripten_is_webgl_context_lost(contextHandle) {
  contextHandle >>>= 0;
  return !GL.contexts[contextHandle] || GL.contexts[contextHandle].GLctx.isContextLost();
}

_emscripten_is_webgl_context_lost.sig = "ip";

var onExits = [];

var JSEvents = {
  memcpy(target, src, size) {
    HEAP8.set(HEAP8.subarray(src >>> 0, src + size >>> 0), target >>> 0);
  },
  removeAllEventListeners() {
    while (JSEvents.eventHandlers.length) {
      JSEvents._removeHandler(JSEvents.eventHandlers.length - 1);
    }
    JSEvents.deferredCalls = [];
  },
  inEventHandler: 0,
  deferredCalls: [],
  deferCall(targetFunction, precedence, argsList) {
    function arraysHaveEqualContent(arrA, arrB) {
      if (arrA.length != arrB.length) return false;
      for (var i in arrA) {
        if (arrA[i] != arrB[i]) return false;
      }
      return true;
    }
    // Test if the given call was already queued, and if so, don't add it again.
    for (var call of JSEvents.deferredCalls) {
      if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
        return;
      }
    }
    JSEvents.deferredCalls.push({
      targetFunction,
      precedence,
      argsList
    });
    JSEvents.deferredCalls.sort((x, y) => x.precedence < y.precedence);
  },
  removeDeferredCalls(targetFunction) {
    JSEvents.deferredCalls = JSEvents.deferredCalls.filter(call => call.targetFunction != targetFunction);
  },
  canPerformEventHandlerRequests() {
    if (navigator.userActivation) {
      // Verify against transient activation status from UserActivation API
      // whether it is possible to perform a request here without needing to defer. See
      // https://developer.mozilla.org/en-US/docs/Web/Security/User_activation#transient_activation
      // and https://caniuse.com/mdn-api_useractivation
      // At the time of writing, Firefox does not support this API: https://bugzilla.mozilla.org/show_bug.cgi?id=1791079
      return navigator.userActivation.isActive;
    }
    return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls;
  },
  runDeferredCalls() {
    if (!JSEvents.canPerformEventHandlerRequests()) {
      return;
    }
    var deferredCalls = JSEvents.deferredCalls;
    JSEvents.deferredCalls = [];
    for (var call of deferredCalls) {
      call.targetFunction(...call.argsList);
    }
  },
  eventHandlers: [],
  removeAllHandlersOnTarget: (target, eventTypeString) => {
    for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
      if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
        JSEvents._removeHandler(i--);
      }
    }
  },
  _removeHandler(i) {
    var h = JSEvents.eventHandlers[i];
    h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
    JSEvents.eventHandlers.splice(i, 1);
  },
  registerOrRemoveHandler(eventHandler) {
    if (!eventHandler.target) {
      return -4;
    }
    if (eventHandler.callbackfunc) {
      eventHandler.eventListenerFunc = function(event) {
        // Increment nesting count for the event handler.
        ++JSEvents.inEventHandler;
        JSEvents.currentEventHandler = eventHandler;
        // Process any old deferred calls the user has placed.
        JSEvents.runDeferredCalls();
        // Process the actual event, calls back to user C code handler.
        eventHandler.handlerFunc(event);
        // Process any new deferred calls that were placed right now from this event handler.
        JSEvents.runDeferredCalls();
        // Out of event handler - restore nesting count.
        --JSEvents.inEventHandler;
      };
      eventHandler.target.addEventListener(eventHandler.eventTypeString, eventHandler.eventListenerFunc, eventHandler.useCapture);
      JSEvents.eventHandlers.push(eventHandler);
    } else {
      for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
        if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
          JSEvents._removeHandler(i--);
        }
      }
    }
    return 0;
  },
  getNodeNameForTarget(target) {
    if (!target) return "";
    if (target == window) return "#window";
    if (target == screen) return "#screen";
    return target?.nodeName || "";
  },
  fullscreenEnabled() {
    return document.fullscreenEnabled || document.webkitFullscreenEnabled;
  }
};

var maybeCStringToJsString = cString => cString > 2 ? UTF8ToString(cString) : cString;

/** @type {Object} */ var specialHTMLTargets = [ 0, typeof document != "undefined" ? document : 0, typeof window != "undefined" ? window : 0 ];

/** @suppress {duplicate } */ var findEventTarget = target => {
  target = maybeCStringToJsString(target);
  var domElement = specialHTMLTargets[target] || (typeof document != "undefined" ? document.querySelector(target) : null);
  return domElement;
};

var findCanvasEventTarget = findEventTarget;

function _emscripten_get_canvas_element_size(target, width, height) {
  target >>>= 0;
  width >>>= 0;
  height >>>= 0;
  var canvas = findCanvasEventTarget(target);
  if (!canvas) return -4;
  HEAP32[((width) >>> 2) >>> 0] = canvas.width;
  HEAP32[((height) >>> 2) >>> 0] = canvas.height;
}

_emscripten_get_canvas_element_size.sig = "ippp";

var getCanvasElementSize = target => {
  var sp = stackSave();
  var w = stackAlloc(8);
  var h = w + 4;
  var targetInt = stringToUTF8OnStack(target.id);
  var ret = _emscripten_get_canvas_element_size(targetInt, w, h);
  var size = [ HEAP32[((w) >>> 2) >>> 0], HEAP32[((h) >>> 2) >>> 0] ];
  stackRestore(sp);
  return size;
};

function _emscripten_set_canvas_element_size(target, width, height) {
  target >>>= 0;
  var canvas = findCanvasEventTarget(target);
  if (!canvas) return -4;
  canvas.width = width;
  canvas.height = height;
  return 0;
}

_emscripten_set_canvas_element_size.sig = "ipii";

var setCanvasElementSize = (target, width, height) => {
  if (!target.controlTransferredOffscreen) {
    target.width = width;
    target.height = height;
  } else {
    // This function is being called from high-level JavaScript code instead of asm.js/Wasm,
    // and it needs to synchronously proxy over to another thread, so marshal the string onto the heap to do the call.
    var sp = stackSave();
    var targetInt = stringToUTF8OnStack(target.id);
    _emscripten_set_canvas_element_size(targetInt, width, height);
    stackRestore(sp);
  }
};

var currentFullscreenStrategy = {};

var registerRestoreOldStyle = canvas => {
  var canvasSize = getCanvasElementSize(canvas);
  var oldWidth = canvasSize[0];
  var oldHeight = canvasSize[1];
  var oldCssWidth = canvas.style.width;
  var oldCssHeight = canvas.style.height;
  var oldBackgroundColor = canvas.style.backgroundColor;
  // Chrome reads color from here.
  var oldDocumentBackgroundColor = document.body.style.backgroundColor;
  // IE11 reads color from here.
  // Firefox always has black background color.
  var oldPaddingLeft = canvas.style.paddingLeft;
  // Chrome, FF, Safari
  var oldPaddingRight = canvas.style.paddingRight;
  var oldPaddingTop = canvas.style.paddingTop;
  var oldPaddingBottom = canvas.style.paddingBottom;
  var oldMarginLeft = canvas.style.marginLeft;
  // IE11
  var oldMarginRight = canvas.style.marginRight;
  var oldMarginTop = canvas.style.marginTop;
  var oldMarginBottom = canvas.style.marginBottom;
  var oldDocumentBodyMargin = document.body.style.margin;
  var oldDocumentOverflow = document.documentElement.style.overflow;
  // Chrome, Firefox
  var oldDocumentScroll = document.body.scroll;
  // IE
  var oldImageRendering = canvas.style.imageRendering;
  function restoreOldStyle() {
    if (!getFullscreenElement()) {
      document.removeEventListener("fullscreenchange", restoreOldStyle);
      // Unprefixed Fullscreen API shipped in Chromium 71 (https://bugs.chromium.org/p/chromium/issues/detail?id=383813)
      // As of Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitfullscreenchange. TODO: revisit this check once Safari ships unprefixed version.
      document.removeEventListener("webkitfullscreenchange", restoreOldStyle);
      setCanvasElementSize(canvas, oldWidth, oldHeight);
      canvas.style.width = oldCssWidth;
      canvas.style.height = oldCssHeight;
      canvas.style.backgroundColor = oldBackgroundColor;
      // Chrome
      // IE11 hack: assigning 'undefined' or an empty string to document.body.style.backgroundColor has no effect, so first assign back the default color
      // before setting the undefined value. Setting undefined value is also important, or otherwise we would later treat that as something that the user
      // had explicitly set so subsequent fullscreen transitions would not set background color properly.
      if (!oldDocumentBackgroundColor) document.body.style.backgroundColor = "white";
      document.body.style.backgroundColor = oldDocumentBackgroundColor;
      // IE11
      canvas.style.paddingLeft = oldPaddingLeft;
      // Chrome, FF, Safari
      canvas.style.paddingRight = oldPaddingRight;
      canvas.style.paddingTop = oldPaddingTop;
      canvas.style.paddingBottom = oldPaddingBottom;
      canvas.style.marginLeft = oldMarginLeft;
      // IE11
      canvas.style.marginRight = oldMarginRight;
      canvas.style.marginTop = oldMarginTop;
      canvas.style.marginBottom = oldMarginBottom;
      document.body.style.margin = oldDocumentBodyMargin;
      document.documentElement.style.overflow = oldDocumentOverflow;
      // Chrome, Firefox
      document.body.scroll = oldDocumentScroll;
      // IE
      canvas.style.imageRendering = oldImageRendering;
      if (canvas.GLctxObject) canvas.GLctxObject.GLctx.viewport(0, 0, oldWidth, oldHeight);
      if (currentFullscreenStrategy.canvasResizedCallback) {
        getWasmTableEntry(currentFullscreenStrategy.canvasResizedCallback)(37, 0, currentFullscreenStrategy.canvasResizedCallbackUserData);
      }
    }
  }
  document.addEventListener("fullscreenchange", restoreOldStyle);
  // Unprefixed Fullscreen API shipped in Chromium 71 (https://bugs.chromium.org/p/chromium/issues/detail?id=383813)
  // As of Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitfullscreenchange. TODO: revisit this check once Safari ships unprefixed version.
  document.addEventListener("webkitfullscreenchange", restoreOldStyle);
  return restoreOldStyle;
};

var setLetterbox = (element, topBottom, leftRight) => {
  // Cannot use margin to specify letterboxes in FF or Chrome, since those ignore margins in fullscreen mode.
  element.style.paddingLeft = element.style.paddingRight = leftRight + "px";
  element.style.paddingTop = element.style.paddingBottom = topBottom + "px";
};

var getBoundingClientRect = e => specialHTMLTargets.indexOf(e) < 0 ? e.getBoundingClientRect() : {
  "left": 0,
  "top": 0
};

var JSEvents_resizeCanvasForFullscreen = (target, strategy) => {
  var restoreOldStyle = registerRestoreOldStyle(target);
  var cssWidth = strategy.softFullscreen ? innerWidth : screen.width;
  var cssHeight = strategy.softFullscreen ? innerHeight : screen.height;
  var rect = getBoundingClientRect(target);
  var windowedCssWidth = rect.width;
  var windowedCssHeight = rect.height;
  var canvasSize = getCanvasElementSize(target);
  var windowedRttWidth = canvasSize[0];
  var windowedRttHeight = canvasSize[1];
  if (strategy.scaleMode == 3) {
    setLetterbox(target, (cssHeight - windowedCssHeight) / 2, (cssWidth - windowedCssWidth) / 2);
    cssWidth = windowedCssWidth;
    cssHeight = windowedCssHeight;
  } else if (strategy.scaleMode == 2) {
    if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
      var desiredCssHeight = windowedRttHeight * cssWidth / windowedRttWidth;
      setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0);
      cssHeight = desiredCssHeight;
    } else {
      var desiredCssWidth = windowedRttWidth * cssHeight / windowedRttHeight;
      setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2);
      cssWidth = desiredCssWidth;
    }
  }
  // If we are adding padding, must choose a background color or otherwise Chrome will give the
  // padding a default white color. Do it only if user has not customized their own background color.
  target.style.backgroundColor ||= "black";
  // IE11 does the same, but requires the color to be set in the document body.
  document.body.style.backgroundColor ||= "black";
  // IE11
  // Firefox always shows black letterboxes independent of style color.
  target.style.width = cssWidth + "px";
  target.style.height = cssHeight + "px";
  if (strategy.filteringMode == 1) {
    target.style.imageRendering = "optimizeSpeed";
    target.style.imageRendering = "-moz-crisp-edges";
    target.style.imageRendering = "-o-crisp-edges";
    target.style.imageRendering = "-webkit-optimize-contrast";
    target.style.imageRendering = "optimize-contrast";
    target.style.imageRendering = "crisp-edges";
    target.style.imageRendering = "pixelated";
  }
  var dpiScale = (strategy.canvasResolutionScaleMode == 2) ? devicePixelRatio : 1;
  if (strategy.canvasResolutionScaleMode != 0) {
    var newWidth = (cssWidth * dpiScale) | 0;
    var newHeight = (cssHeight * dpiScale) | 0;
    setCanvasElementSize(target, newWidth, newHeight);
    if (target.GLctxObject) target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight);
  }
  return restoreOldStyle;
};

var JSEvents_requestFullscreen = (target, strategy) => {
  // EMSCRIPTEN_FULLSCREEN_SCALE_DEFAULT + EMSCRIPTEN_FULLSCREEN_CANVAS_SCALE_NONE is a mode where no extra logic is performed to the DOM elements.
  if (strategy.scaleMode != 0 || strategy.canvasResolutionScaleMode != 0) {
    JSEvents_resizeCanvasForFullscreen(target, strategy);
  }
  if (target.requestFullscreen) {
    target.requestFullscreen();
  } else if (target.webkitRequestFullscreen) {
    target.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
  } else {
    return JSEvents.fullscreenEnabled() ? -3 : -1;
  }
  currentFullscreenStrategy = strategy;
  if (strategy.canvasResizedCallback) {
    getWasmTableEntry(strategy.canvasResizedCallback)(37, 0, strategy.canvasResizedCallbackUserData);
  }
  return 0;
};

var doRequestFullscreen = (target, strategy) => {
  if (!JSEvents.fullscreenEnabled()) return -1;
  target = findEventTarget(target);
  if (!target) return -4;
  if (!target.requestFullscreen && !target.webkitRequestFullscreen) {
    return -3;
  }
  // Queue this function call if we're not currently in an event handler and
  // the user saw it appropriate to do so.
  if (!JSEvents.canPerformEventHandlerRequests()) {
    if (strategy.deferUntilInEventHandler) {
      JSEvents.deferCall(JSEvents_requestFullscreen, 1, [ target, strategy ]);
      return 1;
    }
    return -2;
  }
  return JSEvents_requestFullscreen(target, strategy);
};

function _emscripten_request_fullscreen(target, deferUntilInEventHandler) {
  target >>>= 0;
  var strategy = {
    // These options perform no added logic, but just bare request fullscreen.
    scaleMode: 0,
    canvasResolutionScaleMode: 0,
    filteringMode: 0,
    deferUntilInEventHandler,
    canvasResizedCallbackTargetThread: 2
  };
  return doRequestFullscreen(target, strategy);
}

_emscripten_request_fullscreen.sig = "ipi";

var getHeapMax = () => // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
// full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
// for any code that deals with heap sizes, which would require special
// casing all heap size related code to treat 0 specially.
4294901760;

var growMemory = size => {
  var oldHeapSize = wasmMemory.buffer.byteLength;
  var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
  try {
    // round size grow request up to wasm page size (fixed 64KB per spec)
    wasmMemory.grow(pages);
    // .grow() takes a delta compared to the previous size
    updateMemoryViews();
    return 1;
  } catch (e) {}
};

function _emscripten_resize_heap(requestedSize) {
  requestedSize >>>= 0;
  var oldSize = HEAPU8.length;
  // With multithreaded builds, races can happen (another thread might increase the size
  // in between), so return a failure, and let the caller retry.
  // Memory resize rules:
  // 1.  Always increase heap size to at least the requested size, rounded up
  //     to next page multiple.
  // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
  //     geometrically: increase the heap size according to
  //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
  //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
  // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
  //     linearly: increase the heap size by at least
  //     MEMORY_GROWTH_LINEAR_STEP bytes.
  // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
  //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
  // 4.  If we were unable to allocate as much memory, it may be due to
  //     over-eager decision to excessively reserve due to (3) above.
  //     Hence if an allocation fails, cut down on the amount of excess
  //     growth, in an attempt to succeed to perform a smaller allocation.
  // A limit is set for how much we can grow. We should not exceed that
  // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
  var maxHeapSize = getHeapMax();
  if (requestedSize > maxHeapSize) {
    return false;
  }
  // Loop through potential heap size increases. If we attempt a too eager
  // reservation that fails, cut down on the attempted size and reserve a
  // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
  for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
    var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
    // ensure geometric growth
    // but limit overreserving (default to capping at +96MB overgrowth at most)
    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
    var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
    var replacement = growMemory(newSize);
    if (replacement) {
      return true;
    }
  }
  return false;
}

_emscripten_resize_heap.sig = "ip";

var registerKeyEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  JSEvents.keyEvent ||= _malloc(160);
  var keyEventHandlerFunc = e => {
    var keyEventData = JSEvents.keyEvent;
    HEAPF64[((keyEventData) >>> 3) >>> 0] = e.timeStamp;
    var idx = ((keyEventData) >>> 2);
    HEAP32[idx + 2 >>> 0] = e.location;
    HEAP8[keyEventData + 12 >>> 0] = e.ctrlKey;
    HEAP8[keyEventData + 13 >>> 0] = e.shiftKey;
    HEAP8[keyEventData + 14 >>> 0] = e.altKey;
    HEAP8[keyEventData + 15 >>> 0] = e.metaKey;
    HEAP8[keyEventData + 16 >>> 0] = e.repeat;
    HEAP32[idx + 5 >>> 0] = e.charCode;
    HEAP32[idx + 6 >>> 0] = e.keyCode;
    HEAP32[idx + 7 >>> 0] = e.which;
    stringToUTF8(e.key || "", keyEventData + 32, 32);
    stringToUTF8(e.code || "", keyEventData + 64, 32);
    stringToUTF8(e.char || "", keyEventData + 96, 32);
    stringToUTF8(e.locale || "", keyEventData + 128, 32);
    if (getWasmTableEntry(callbackfunc)(eventTypeId, keyEventData, userData)) e.preventDefault();
  };
  var eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    callbackfunc,
    handlerFunc: keyEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_keydown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerKeyEventCallback(target, userData, useCapture, callbackfunc, 2, "keydown", targetThread);
}

_emscripten_set_keydown_callback_on_thread.sig = "ippipp";

function _emscripten_set_keypress_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerKeyEventCallback(target, userData, useCapture, callbackfunc, 1, "keypress", targetThread);
}

_emscripten_set_keypress_callback_on_thread.sig = "ippipp";

function _emscripten_set_keyup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerKeyEventCallback(target, userData, useCapture, callbackfunc, 3, "keyup", targetThread);
}

_emscripten_set_keyup_callback_on_thread.sig = "ippipp";

var _emscripten_set_main_loop_timing = (mode, value) => {
  MainLoop.timingMode = mode;
  MainLoop.timingValue = value;
  if (!MainLoop.func) {
    return 1;
  }
  if (!MainLoop.running) {
    MainLoop.running = true;
  }
  if (mode == 0) {
    MainLoop.scheduler = function MainLoop_scheduler_setTimeout() {
      var timeUntilNextTick = Math.max(0, MainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
      setTimeout(MainLoop.runner, timeUntilNextTick);
    };
    MainLoop.method = "timeout";
  } else if (mode == 1) {
    MainLoop.scheduler = function MainLoop_scheduler_rAF() {
      MainLoop.requestAnimationFrame(MainLoop.runner);
    };
    MainLoop.method = "rAF";
  } else if (mode == 2) {
    if (typeof MainLoop.setImmediate == "undefined") {
      if (typeof setImmediate == "undefined") {
        // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
        var setImmediates = [];
        var emscriptenMainLoopMessageId = "setimmediate";
        /** @param {Event} event */ var MainLoop_setImmediate_messageHandler = event => {
          // When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
          // so check for both cases.
          if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
            event.stopPropagation();
            setImmediates.shift()();
          }
        };
        addEventListener("message", MainLoop_setImmediate_messageHandler, true);
        MainLoop.setImmediate = /** @type{function(function(): ?, ...?): number} */ (func => {
          setImmediates.push(func);
          if (ENVIRONMENT_IS_WORKER) {
            Module["setImmediates"] ??= [];
            Module["setImmediates"].push(func);
            postMessage({
              target: emscriptenMainLoopMessageId
            });
          } else postMessage(emscriptenMainLoopMessageId, "*");
        });
      } else {
        MainLoop.setImmediate = setImmediate;
      }
    }
    MainLoop.scheduler = function MainLoop_scheduler_setImmediate() {
      MainLoop.setImmediate(MainLoop.runner);
    };
    MainLoop.method = "immediate";
  }
  return 0;
};

_emscripten_set_main_loop_timing.sig = "iii";

var MainLoop = {
  running: false,
  scheduler: null,
  method: "",
  currentlyRunningMainloop: 0,
  func: null,
  arg: 0,
  timingMode: 0,
  timingValue: 0,
  currentFrameNumber: 0,
  queue: [],
  preMainLoop: [],
  postMainLoop: [],
  pause() {
    MainLoop.scheduler = null;
    // Incrementing this signals the previous main loop that it's now become old, and it must return.
    MainLoop.currentlyRunningMainloop++;
  },
  resume() {
    MainLoop.currentlyRunningMainloop++;
    var timingMode = MainLoop.timingMode;
    var timingValue = MainLoop.timingValue;
    var func = MainLoop.func;
    MainLoop.func = null;
    // do not set timing and call scheduler, we will do it on the next lines
    setMainLoop(func, 0, false, MainLoop.arg, true);
    _emscripten_set_main_loop_timing(timingMode, timingValue);
    MainLoop.scheduler();
  },
  updateStatus() {
    if (Module["setStatus"]) {
      var message = Module["statusMessage"] || "Please wait...";
      var remaining = MainLoop.remainingBlockers ?? 0;
      var expected = MainLoop.expectedBlockers ?? 0;
      if (remaining) {
        if (remaining < expected) {
          Module["setStatus"](`{message} ({expected - remaining}/{expected})`);
        } else {
          Module["setStatus"](message);
        }
      } else {
        Module["setStatus"]("");
      }
    }
  },
  init() {
    Module["preMainLoop"] && MainLoop.preMainLoop.push(Module["preMainLoop"]);
    Module["postMainLoop"] && MainLoop.postMainLoop.push(Module["postMainLoop"]);
  },
  runIter(func) {
    if (ABORT) return;
    for (var pre of MainLoop.preMainLoop) {
      if (pre() === false) {
        return;
      }
    }
    callUserCallback(func);
    for (var post of MainLoop.postMainLoop) {
      post();
    }
  },
  nextRAF: 0,
  fakeRequestAnimationFrame(func) {
    // try to keep 60fps between calls to here
    var now = Date.now();
    if (MainLoop.nextRAF === 0) {
      MainLoop.nextRAF = now + 1e3 / 60;
    } else {
      while (now + 2 >= MainLoop.nextRAF) {
        // fudge a little, to avoid timer jitter causing us to do lots of delay:0
        MainLoop.nextRAF += 1e3 / 60;
      }
    }
    var delay = Math.max(MainLoop.nextRAF - now, 0);
    setTimeout(func, delay);
  },
  requestAnimationFrame(func) {
    if (typeof requestAnimationFrame == "function") {
      requestAnimationFrame(func);
    } else {
      MainLoop.fakeRequestAnimationFrame(func);
    }
  }
};

/**
     * @param {number=} arg
     * @param {boolean=} noSetTiming
     */ var setMainLoop = (iterFunc, fps, simulateInfiniteLoop, arg, noSetTiming) => {
  MainLoop.func = iterFunc;
  MainLoop.arg = arg;
  var thisMainLoopId = MainLoop.currentlyRunningMainloop;
  function checkIsRunning() {
    if (thisMainLoopId < MainLoop.currentlyRunningMainloop) {
      maybeExit();
      return false;
    }
    return true;
  }
  // We create the loop runner here but it is not actually running until
  // _emscripten_set_main_loop_timing is called (which might happen a
  // later time).  This member signifies that the current runner has not
  // yet been started so that we can call runtimeKeepalivePush when it
  // gets it timing set for the first time.
  MainLoop.running = false;
  MainLoop.runner = function MainLoop_runner() {
    if (ABORT) return;
    if (MainLoop.queue.length > 0) {
      var start = Date.now();
      var blocker = MainLoop.queue.shift();
      blocker.func(blocker.arg);
      if (MainLoop.remainingBlockers) {
        var remaining = MainLoop.remainingBlockers;
        var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
        if (blocker.counted) {
          MainLoop.remainingBlockers = next;
        } else {
          // not counted, but move the progress along a tiny bit
          next = next + .5;
          // do not steal all the next one's progress
          MainLoop.remainingBlockers = (8 * remaining + next) / 9;
        }
      }
      MainLoop.updateStatus();
      // catches pause/resume main loop from blocker execution
      if (!checkIsRunning()) return;
      setTimeout(MainLoop.runner, 0);
      return;
    }
    // catch pauses from non-main loop sources
    if (!checkIsRunning()) return;
    // Implement very basic swap interval control
    MainLoop.currentFrameNumber = MainLoop.currentFrameNumber + 1 | 0;
    if (MainLoop.timingMode == 1 && MainLoop.timingValue > 1 && MainLoop.currentFrameNumber % MainLoop.timingValue != 0) {
      // Not the scheduled time to render this frame - skip.
      MainLoop.scheduler();
      return;
    } else if (MainLoop.timingMode == 0) {
      MainLoop.tickStartTime = _emscripten_get_now();
    }
    MainLoop.runIter(iterFunc);
    // catch pauses from the main loop itself
    if (!checkIsRunning()) return;
    MainLoop.scheduler();
  };
  if (!noSetTiming) {
    if (fps > 0) {
      _emscripten_set_main_loop_timing(0, 1e3 / fps);
    } else {
      // Do rAF by rendering each frame (no decimating)
      _emscripten_set_main_loop_timing(1, 1);
    }
    MainLoop.scheduler();
  }
  if (simulateInfiniteLoop) {
    throw "unwind";
  }
};

var _emscripten_set_main_loop_arg = function(func, arg, fps, simulateInfiniteLoop) {
  func >>>= 0;
  arg >>>= 0;
  var iterFunc = () => getWasmTableEntry(func)(arg);
  setMainLoop(iterFunc, fps, simulateInfiniteLoop, arg);
};

_emscripten_set_main_loop_arg.sig = "vppii";

var fillMouseEventData = (eventStruct, e, target) => {
  HEAPF64[((eventStruct) >>> 3) >>> 0] = e.timeStamp;
  var idx = ((eventStruct) >>> 2);
  HEAP32[idx + 2 >>> 0] = e.screenX;
  HEAP32[idx + 3 >>> 0] = e.screenY;
  HEAP32[idx + 4 >>> 0] = e.clientX;
  HEAP32[idx + 5 >>> 0] = e.clientY;
  HEAP8[eventStruct + 24 >>> 0] = e.ctrlKey;
  HEAP8[eventStruct + 25 >>> 0] = e.shiftKey;
  HEAP8[eventStruct + 26 >>> 0] = e.altKey;
  HEAP8[eventStruct + 27 >>> 0] = e.metaKey;
  HEAP16[idx * 2 + 14 >>> 0] = e.button;
  HEAP16[idx * 2 + 15 >>> 0] = e.buttons;
  HEAP32[idx + 8 >>> 0] = e["movementX"];
  HEAP32[idx + 9 >>> 0] = e["movementY"];
  // Note: rect contains doubles (truncated to placate SAFE_HEAP, which is the same behaviour when writing to HEAP32 anyway)
  var rect = getBoundingClientRect(target);
  HEAP32[idx + 10 >>> 0] = e.clientX - (rect.left | 0);
  HEAP32[idx + 11 >>> 0] = e.clientY - (rect.top | 0);
};

var registerMouseEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  JSEvents.mouseEvent ||= _malloc(64);
  target = findEventTarget(target);
  var mouseEventHandlerFunc = (e = event) => {
    // TODO: Make this access thread safe, or this could update live while app is reading it.
    fillMouseEventData(JSEvents.mouseEvent, e, target);
    if (getWasmTableEntry(callbackfunc)(eventTypeId, JSEvents.mouseEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    allowsDeferredCalls: eventTypeString != "mousemove" && eventTypeString != "mouseenter" && eventTypeString != "mouseleave",
    // Mouse move events do not allow fullscreen/pointer lock requests to be handled in them!
    eventTypeString,
    callbackfunc,
    handlerFunc: mouseEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_mousedown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 5, "mousedown", targetThread);
}

_emscripten_set_mousedown_callback_on_thread.sig = "ippipp";

function _emscripten_set_mouseenter_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 33, "mouseenter", targetThread);
}

_emscripten_set_mouseenter_callback_on_thread.sig = "ippipp";

function _emscripten_set_mouseleave_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 34, "mouseleave", targetThread);
}

_emscripten_set_mouseleave_callback_on_thread.sig = "ippipp";

function _emscripten_set_mousemove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 8, "mousemove", targetThread);
}

_emscripten_set_mousemove_callback_on_thread.sig = "ippipp";

function _emscripten_set_mouseup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerMouseEventCallback(target, userData, useCapture, callbackfunc, 6, "mouseup", targetThread);
}

_emscripten_set_mouseup_callback_on_thread.sig = "ippipp";

var registerTouchEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  JSEvents.touchEvent ||= _malloc(1552);
  target = findEventTarget(target);
  var touchEventHandlerFunc = e => {
    var t, touches = {}, et = e.touches;
    // To ease marshalling different kinds of touches that browser reports (all touches are listed in e.touches,
    // only changed touches in e.changedTouches, and touches on target at a.targetTouches), mark a boolean in
    // each Touch object so that we can later loop only once over all touches we see to marshall over to Wasm.
    for (let t of et) {
      // Browser might recycle the generated Touch objects between each frame (Firefox on Android), so reset any
      // changed/target states we may have set from previous frame.
      t.isChanged = t.onTarget = 0;
      touches[t.identifier] = t;
    }
    // Mark which touches are part of the changedTouches list.
    for (let t of e.changedTouches) {
      t.isChanged = 1;
      touches[t.identifier] = t;
    }
    // Mark which touches are part of the targetTouches list.
    for (let t of e.targetTouches) {
      touches[t.identifier].onTarget = 1;
    }
    var touchEvent = JSEvents.touchEvent;
    HEAPF64[((touchEvent) >>> 3) >>> 0] = e.timeStamp;
    HEAP8[touchEvent + 12 >>> 0] = e.ctrlKey;
    HEAP8[touchEvent + 13 >>> 0] = e.shiftKey;
    HEAP8[touchEvent + 14 >>> 0] = e.altKey;
    HEAP8[touchEvent + 15 >>> 0] = e.metaKey;
    var idx = touchEvent + 16;
    var targetRect = getBoundingClientRect(target);
    var numTouches = 0;
    for (let t of Object.values(touches)) {
      var idx32 = ((idx) >>> 2);
      // Pre-shift the ptr to index to HEAP32 to save code size
      HEAP32[idx32 + 0 >>> 0] = t.identifier;
      HEAP32[idx32 + 1 >>> 0] = t.screenX;
      HEAP32[idx32 + 2 >>> 0] = t.screenY;
      HEAP32[idx32 + 3 >>> 0] = t.clientX;
      HEAP32[idx32 + 4 >>> 0] = t.clientY;
      HEAP32[idx32 + 5 >>> 0] = t.pageX;
      HEAP32[idx32 + 6 >>> 0] = t.pageY;
      HEAP8[idx + 28 >>> 0] = t.isChanged;
      HEAP8[idx + 29 >>> 0] = t.onTarget;
      HEAP32[idx32 + 8 >>> 0] = t.clientX - (targetRect.left | 0);
      HEAP32[idx32 + 9 >>> 0] = t.clientY - (targetRect.top | 0);
      idx += 48;
      if (++numTouches > 31) {
        break;
      }
    }
    HEAP32[(((touchEvent) + (8)) >>> 2) >>> 0] = numTouches;
    if (getWasmTableEntry(callbackfunc)(eventTypeId, touchEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    allowsDeferredCalls: eventTypeString == "touchstart" || eventTypeString == "touchend",
    eventTypeString,
    callbackfunc,
    handlerFunc: touchEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_touchcancel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerTouchEventCallback(target, userData, useCapture, callbackfunc, 25, "touchcancel", targetThread);
}

_emscripten_set_touchcancel_callback_on_thread.sig = "ippipp";

function _emscripten_set_touchend_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerTouchEventCallback(target, userData, useCapture, callbackfunc, 23, "touchend", targetThread);
}

_emscripten_set_touchend_callback_on_thread.sig = "ippipp";

function _emscripten_set_touchmove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerTouchEventCallback(target, userData, useCapture, callbackfunc, 24, "touchmove", targetThread);
}

_emscripten_set_touchmove_callback_on_thread.sig = "ippipp";

function _emscripten_set_touchstart_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  return registerTouchEventCallback(target, userData, useCapture, callbackfunc, 22, "touchstart", targetThread);
}

_emscripten_set_touchstart_callback_on_thread.sig = "ippipp";

var fillVisibilityChangeEventData = eventStruct => {
  var visibilityStates = [ "hidden", "visible", "prerender", "unloaded" ];
  var visibilityState = visibilityStates.indexOf(document.visibilityState);
  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */ HEAP8[eventStruct >>> 0] = document.hidden;
  HEAP32[(((eventStruct) + (4)) >>> 2) >>> 0] = visibilityState;
};

var registerVisibilityChangeEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  JSEvents.visibilityChangeEvent ||= _malloc(8);
  var visibilityChangeEventHandlerFunc = (e = event) => {
    var visibilityChangeEvent = JSEvents.visibilityChangeEvent;
    fillVisibilityChangeEventData(visibilityChangeEvent);
    if (getWasmTableEntry(callbackfunc)(eventTypeId, visibilityChangeEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    callbackfunc,
    handlerFunc: visibilityChangeEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_visibilitychange_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  if (!specialHTMLTargets[1]) {
    return -4;
  }
  return registerVisibilityChangeEventCallback(specialHTMLTargets[1], userData, useCapture, callbackfunc, 21, "visibilitychange", targetThread);
}

_emscripten_set_visibilitychange_callback_on_thread.sig = "ipipp";

var registerWebGlEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  var webGlEventHandlerFunc = (e = event) => {
    if (getWasmTableEntry(callbackfunc)(eventTypeId, 0, userData)) e.preventDefault();
  };
  var eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    callbackfunc,
    handlerFunc: webGlEventHandlerFunc,
    useCapture
  };
  JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_webglcontextlost_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  registerWebGlEventCallback(target, userData, useCapture, callbackfunc, 31, "webglcontextlost", targetThread);
  return 0;
}

_emscripten_set_webglcontextlost_callback_on_thread.sig = "ippipp";

function _emscripten_set_webglcontextrestored_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  registerWebGlEventCallback(target, userData, useCapture, callbackfunc, 32, "webglcontextrestored", targetThread);
  return 0;
}

_emscripten_set_webglcontextrestored_callback_on_thread.sig = "ippipp";

var registerWheelEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  JSEvents.wheelEvent ||= _malloc(96);
  // The DOM Level 3 events spec event 'wheel'
  var wheelHandlerFunc = (e = event) => {
    var wheelEvent = JSEvents.wheelEvent;
    fillMouseEventData(wheelEvent, e, target);
    HEAPF64[(((wheelEvent) + (64)) >>> 3) >>> 0] = e["deltaX"];
    HEAPF64[(((wheelEvent) + (72)) >>> 3) >>> 0] = e["deltaY"];
    HEAPF64[(((wheelEvent) + (80)) >>> 3) >>> 0] = e["deltaZ"];
    HEAP32[(((wheelEvent) + (88)) >>> 2) >>> 0] = e["deltaMode"];
    if (getWasmTableEntry(callbackfunc)(eventTypeId, wheelEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    allowsDeferredCalls: true,
    eventTypeString,
    callbackfunc,
    handlerFunc: wheelHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_wheel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  target >>>= 0;
  userData >>>= 0;
  callbackfunc >>>= 0;
  targetThread >>>= 0;
  target = findEventTarget(target);
  if (!target) return -4;
  if (typeof target.onwheel != "undefined") {
    return registerWheelEventCallback(target, userData, useCapture, callbackfunc, 9, "wheel", targetThread);
  } else {
    return -1;
  }
}

_emscripten_set_wheel_callback_on_thread.sig = "ippipp";

function _emscripten_set_window_title(title) {
  title >>>= 0;
  return document.title = UTF8ToString(title);
}

_emscripten_set_window_title.sig = "vp";

var webglPowerPreferences = [ "default", "low-power", "high-performance" ];

/** @suppress {duplicate } */ function _emscripten_webgl_do_create_context(target, attributes) {
  target >>>= 0;
  attributes >>>= 0;
  var attr32 = ((attributes) >>> 2);
  var powerPreference = HEAP32[attr32 + (8 >> 2) >>> 0];
  var contextAttributes = {
    "alpha": !!HEAP8[attributes + 0 >>> 0],
    "depth": !!HEAP8[attributes + 1 >>> 0],
    "stencil": !!HEAP8[attributes + 2 >>> 0],
    "antialias": !!HEAP8[attributes + 3 >>> 0],
    "premultipliedAlpha": !!HEAP8[attributes + 4 >>> 0],
    "preserveDrawingBuffer": !!HEAP8[attributes + 5 >>> 0],
    "powerPreference": webglPowerPreferences[powerPreference],
    "failIfMajorPerformanceCaveat": !!HEAP8[attributes + 12 >>> 0],
    // The following are not predefined WebGL context attributes in the WebGL specification, so the property names can be minified by Closure.
    majorVersion: HEAP32[attr32 + (16 >> 2) >>> 0],
    minorVersion: HEAP32[attr32 + (20 >> 2) >>> 0],
    enableExtensionsByDefault: HEAP8[attributes + 24 >>> 0],
    explicitSwapControl: HEAP8[attributes + 25 >>> 0],
    proxyContextToMainThread: HEAP32[attr32 + (28 >> 2) >>> 0],
    renderViaOffscreenBackBuffer: HEAP8[attributes + 32 >>> 0]
  };
  var canvas = findCanvasEventTarget(target);
  if (!canvas) {
    return 0;
  }
  if (contextAttributes.explicitSwapControl) {
    return 0;
  }
  var contextHandle = GL.createContext(canvas, contextAttributes);
  return contextHandle;
}

_emscripten_webgl_do_create_context.sig = "ppp";

var _emscripten_webgl_create_context = _emscripten_webgl_do_create_context;

_emscripten_webgl_create_context.sig = "ppp";

function _emscripten_webgl_make_context_current(contextHandle) {
  contextHandle >>>= 0;
  var success = GL.makeContextCurrent(contextHandle);
  return success ? 0 : -5;
}

_emscripten_webgl_make_context_current.sig = "ip";

var ENV = {};

var getExecutableName = () => thisProgram || "./this.program";

var getEnvStrings = () => {
  if (!getEnvStrings.strings) {
    // Default values.
    // Browser language detection #8751
    var lang = ((typeof navigator == "object" && navigator.language) || "C").replace("-", "_") + ".UTF-8";
    var env = {
      "USER": "web_user",
      "LOGNAME": "web_user",
      "PATH": "/",
      "PWD": "/",
      "HOME": "/home/web_user",
      "LANG": lang,
      "_": getExecutableName()
    };
    // Apply the user-provided values, if any.
    for (var x in ENV) {
      // x is a key in ENV; if ENV[x] is undefined, that means it was
      // explicitly set to be so. We allow user code to do that to
      // force variables with default values to remain unset.
      if (ENV[x] === undefined) delete env[x]; else env[x] = ENV[x];
    }
    var strings = [];
    for (var x in env) {
      strings.push(`${x}=${env[x]}`);
    }
    getEnvStrings.strings = strings;
  }
  return getEnvStrings.strings;
};

function _environ_get(__environ, environ_buf) {
  __environ >>>= 0;
  environ_buf >>>= 0;
  var bufSize = 0;
  var envp = 0;
  for (var string of getEnvStrings()) {
    var ptr = environ_buf + bufSize;
    HEAPU32[(((__environ) + (envp)) >>> 2) >>> 0] = ptr;
    bufSize += stringToUTF8(string, ptr, Infinity) + 1;
    envp += 4;
  }
  return 0;
}

_environ_get.sig = "ipp";

function _environ_sizes_get(penviron_count, penviron_buf_size) {
  penviron_count >>>= 0;
  penviron_buf_size >>>= 0;
  var strings = getEnvStrings();
  HEAPU32[((penviron_count) >>> 2) >>> 0] = strings.length;
  var bufSize = 0;
  for (var string of strings) {
    bufSize += lengthBytesUTF8(string) + 1;
  }
  HEAPU32[((penviron_buf_size) >>> 2) >>> 0] = bufSize;
  return 0;
}

_environ_sizes_get.sig = "ipp";

function _fd_close(fd) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.close(stream);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_close.sig = "ii";

function _fd_fdstat_get(fd, pbuf) {
  pbuf >>>= 0;
  try {
    var rightsBase = 0;
    var rightsInheriting = 0;
    var flags = 0;
    {
      var stream = SYSCALLS.getStreamFromFD(fd);
      // All character devices are terminals (other things a Linux system would
      // assume is a character device, like the mouse, we have special APIs for).
      var type = stream.tty ? 2 : FS.isDir(stream.mode) ? 3 : FS.isLink(stream.mode) ? 7 : 4;
    }
    HEAP8[pbuf >>> 0] = type;
    HEAP16[(((pbuf) + (2)) >>> 1) >>> 0] = flags;
    HEAP64[(((pbuf) + (8)) >>> 3) >>> 0] = BigInt(rightsBase);
    HEAP64[(((pbuf) + (16)) >>> 3) >>> 0] = BigInt(rightsInheriting);
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_fdstat_get.sig = "iip";

/** @param {number=} offset */ var doReadv = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[((iov) >>> 2) >>> 0];
    var len = HEAPU32[(((iov) + (4)) >>> 2) >>> 0];
    iov += 8;
    var curr = FS.read(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) break;
    // nothing more to read
    if (typeof offset != "undefined") {
      offset += curr;
    }
  }
  return ret;
};

function _fd_read(fd, iov, iovcnt, pnum) {
  iov >>>= 0;
  iovcnt >>>= 0;
  pnum >>>= 0;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doReadv(stream, iov, iovcnt);
    HEAPU32[((pnum) >>> 2) >>> 0] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_read.sig = "iippp";

function _fd_seek(fd, offset, whence, newOffset) {
  offset = bigintToI53Checked(offset);
  newOffset >>>= 0;
  try {
    if (isNaN(offset)) return 61;
    var stream = SYSCALLS.getStreamFromFD(fd);
    FS.llseek(stream, offset, whence);
    HEAP64[((newOffset) >>> 3) >>> 0] = BigInt(stream.position);
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    // reset readdir state
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_seek.sig = "iijip";

function _fd_sync(fd) {
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    if (stream.stream_ops?.fsync) {
      return stream.stream_ops.fsync(stream);
    }
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_sync.sig = "ii";

/** @param {number=} offset */ var doWritev = (stream, iov, iovcnt, offset) => {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[((iov) >>> 2) >>> 0];
    var len = HEAPU32[(((iov) + (4)) >>> 2) >>> 0];
    iov += 8;
    var curr = FS.write(stream, HEAP8, ptr, len, offset);
    if (curr < 0) return -1;
    ret += curr;
    if (curr < len) {
      // No more space to write.
      break;
    }
    if (typeof offset != "undefined") {
      offset += curr;
    }
  }
  return ret;
};

function _fd_write(fd, iov, iovcnt, pnum) {
  iov >>>= 0;
  iovcnt >>>= 0;
  pnum >>>= 0;
  try {
    var stream = SYSCALLS.getStreamFromFD(fd);
    var num = doWritev(stream, iov, iovcnt);
    HEAPU32[((pnum) >>> 2) >>> 0] = num;
    return 0;
  } catch (e) {
    if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
    return e.errno;
  }
}

_fd_write.sig = "iippp";

function _getaddrinfo(node, service, hint, out) {
  node >>>= 0;
  service >>>= 0;
  hint >>>= 0;
  out >>>= 0;
  var addr = 0;
  var port = 0;
  var flags = 0;
  var family = 0;
  var type = 0;
  var proto = 0;
  var ai;
  function allocaddrinfo(family, type, proto, canon, addr, port) {
    var sa, salen, ai;
    var errno;
    salen = family === 10 ? 28 : 16;
    addr = family === 10 ? inetNtop6(addr) : inetNtop4(addr);
    sa = _malloc(salen);
    errno = writeSockaddr(sa, family, addr, port);
    ai = _malloc(32);
    HEAP32[(((ai) + (4)) >>> 2) >>> 0] = family;
    HEAP32[(((ai) + (8)) >>> 2) >>> 0] = type;
    HEAP32[(((ai) + (12)) >>> 2) >>> 0] = proto;
    HEAPU32[(((ai) + (24)) >>> 2) >>> 0] = canon;
    HEAPU32[(((ai) + (20)) >>> 2) >>> 0] = sa;
    if (family === 10) {
      HEAP32[(((ai) + (16)) >>> 2) >>> 0] = 28;
    } else {
      HEAP32[(((ai) + (16)) >>> 2) >>> 0] = 16;
    }
    HEAP32[(((ai) + (28)) >>> 2) >>> 0] = 0;
    return ai;
  }
  if (hint) {
    flags = HEAP32[((hint) >>> 2) >>> 0];
    family = HEAP32[(((hint) + (4)) >>> 2) >>> 0];
    type = HEAP32[(((hint) + (8)) >>> 2) >>> 0];
    proto = HEAP32[(((hint) + (12)) >>> 2) >>> 0];
  }
  if (type && !proto) {
    proto = type === 2 ? 17 : 6;
  }
  if (!type && proto) {
    type = proto === 17 ? 2 : 1;
  }
  // If type or proto are set to zero in hints we should really be returning multiple addrinfo values, but for
  // now default to a TCP STREAM socket so we can at least return a sensible addrinfo given NULL hints.
  if (proto === 0) {
    proto = 6;
  }
  if (type === 0) {
    type = 1;
  }
  if (!node && !service) {
    return -2;
  }
  if (flags & ~(1 | 2 | 4 | 1024 | 8 | 16 | 32)) {
    return -1;
  }
  if (hint !== 0 && (HEAP32[((hint) >>> 2) >>> 0] & 2) && !node) {
    return -1;
  }
  if (flags & 32) {
    // TODO
    return -2;
  }
  if (type !== 0 && type !== 1 && type !== 2) {
    return -7;
  }
  if (family !== 0 && family !== 2 && family !== 10) {
    return -6;
  }
  if (service) {
    service = UTF8ToString(service);
    port = parseInt(service, 10);
    if (isNaN(port)) {
      if (flags & 1024) {
        return -2;
      }
      // TODO support resolving well-known service names from:
      // http://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.txt
      return -8;
    }
  }
  if (!node) {
    if (family === 0) {
      family = 2;
    }
    if ((flags & 1) === 0) {
      if (family === 2) {
        addr = _htonl(2130706433);
      } else {
        addr = [ 0, 0, 0, _htonl(1) ];
      }
    }
    ai = allocaddrinfo(family, type, proto, null, addr, port);
    HEAPU32[((out) >>> 2) >>> 0] = ai;
    return 0;
  }
  // try as a numeric address
  node = UTF8ToString(node);
  addr = inetPton4(node);
  if (addr !== null) {
    // incoming node is a valid ipv4 address
    if (family === 0 || family === 2) {
      family = 2;
    } else if (family === 10 && (flags & 8)) {
      addr = [ 0, 0, _htonl(65535), addr ];
      family = 10;
    } else {
      return -2;
    }
  } else {
    addr = inetPton6(node);
    if (addr !== null) {
      // incoming node is a valid ipv6 address
      if (family === 0 || family === 10) {
        family = 10;
      } else {
        return -2;
      }
    }
  }
  if (addr != null) {
    ai = allocaddrinfo(family, type, proto, node, addr, port);
    HEAPU32[((out) >>> 2) >>> 0] = ai;
    return 0;
  }
  if (flags & 4) {
    return -2;
  }
  // try as a hostname
  // resolve the hostname to a temporary fake address
  node = DNS.lookup_name(node);
  addr = inetPton4(node);
  if (family === 0) {
    family = 2;
  } else if (family === 10) {
    addr = [ 0, 0, _htonl(65535), addr ];
  }
  ai = allocaddrinfo(family, type, proto, null, addr, port);
  HEAPU32[((out) >>> 2) >>> 0] = ai;
  return 0;
}

_getaddrinfo.sig = "ipppp";

function _getnameinfo(sa, salen, node, nodelen, serv, servlen, flags) {
  sa >>>= 0;
  node >>>= 0;
  serv >>>= 0;
  var info = readSockaddr(sa, salen);
  if (info.errno) {
    return -6;
  }
  var port = info.port;
  var addr = info.addr;
  var overflowed = false;
  if (node && nodelen) {
    var lookup;
    if ((flags & 1) || !(lookup = DNS.lookup_addr(addr))) {
      if (flags & 8) {
        return -2;
      }
    } else {
      addr = lookup;
    }
    var numBytesWrittenExclNull = stringToUTF8(addr, node, nodelen);
    if (numBytesWrittenExclNull + 1 >= nodelen) {
      overflowed = true;
    }
  }
  if (serv && servlen) {
    port = "" + port;
    var numBytesWrittenExclNull = stringToUTF8(port, serv, servlen);
    if (numBytesWrittenExclNull + 1 >= servlen) {
      overflowed = true;
    }
  }
  if (overflowed) {
    // Note: even when we overflow, getnameinfo() is specced to write out the truncated results.
    return -12;
  }
  return 0;
}

_getnameinfo.sig = "ipipipii";

var _glActiveTexture = x0 => GLctx.activeTexture(x0);

_glActiveTexture.sig = "vi";

var _glAttachShader = (program, shader) => {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
};

_glAttachShader.sig = "vii";

function _glBindAttribLocation(program, index, name) {
  name >>>= 0;
  GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
}

_glBindAttribLocation.sig = "viip";

var _glBindBuffer = (target, buffer) => {
  if (target == 35051) {
    // In WebGL 2 glReadPixels entry point, we need to use a different WebGL 2
    // API function call when a buffer is bound to
    // GL_PIXEL_PACK_BUFFER_BINDING point, so must keep track whether that
    // binding point is non-null to know what is the proper API function to
    // call.
    GLctx.currentPixelPackBufferBinding = buffer;
  } else if (target == 35052) {
    // In WebGL 2 gl(Compressed)Tex(Sub)Image[23]D entry points, we need to
    // use a different WebGL 2 API function call when a buffer is bound to
    // GL_PIXEL_UNPACK_BUFFER_BINDING point, so must keep track whether that
    // binding point is non-null to know what is the proper API function to
    // call.
    GLctx.currentPixelUnpackBufferBinding = buffer;
  }
  GLctx.bindBuffer(target, GL.buffers[buffer]);
};

_glBindBuffer.sig = "vii";

var _glBindFramebuffer = (target, framebuffer) => {
  GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
};

_glBindFramebuffer.sig = "vii";

var _glBindRenderbuffer = (target, renderbuffer) => {
  GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
};

_glBindRenderbuffer.sig = "vii";

var _glBindTexture = (target, texture) => {
  GLctx.bindTexture(target, GL.textures[texture]);
};

_glBindTexture.sig = "vii";

var _glBlendFunc = (x0, x1) => GLctx.blendFunc(x0, x1);

_glBlendFunc.sig = "vii";

function _glBufferData(target, size, data, usage) {
  size >>>= 0;
  data >>>= 0;
  // N.b. here first form specifies a heap subarray, second form an integer
  // size, so the ?: code here is polymorphic. It is advised to avoid
  // randomly mixing both uses in calling code, to avoid any potential JS
  // engine JIT issues.
  GLctx.bufferData(target, data ? HEAPU8.subarray(data >>> 0, data + size >>> 0) : size, usage);
}

_glBufferData.sig = "vippi";

function _glBufferSubData(target, offset, size, data) {
  offset >>>= 0;
  size >>>= 0;
  data >>>= 0;
  GLctx.bufferSubData(target, offset, HEAPU8.subarray(data >>> 0, data + size >>> 0));
}

_glBufferSubData.sig = "vippp";

var _glClear = x0 => GLctx.clear(x0);

_glClear.sig = "vi";

var _glClearColor = (x0, x1, x2, x3) => GLctx.clearColor(x0, x1, x2, x3);

_glClearColor.sig = "vffff";

var _glClearDepthf = x0 => GLctx.clearDepth(x0);

_glClearDepthf.sig = "vf";

var _glClearStencil = x0 => GLctx.clearStencil(x0);

_glClearStencil.sig = "vi";

var _glCompileShader = shader => {
  GLctx.compileShader(GL.shaders[shader]);
};

_glCompileShader.sig = "vi";

var _glCreateProgram = () => {
  var id = GL.getNewId(GL.programs);
  var program = GLctx.createProgram();
  // Store additional information needed for each shader program:
  program.name = id;
  // Lazy cache results of
  // glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
  program.maxUniformLength = program.maxAttributeLength = program.maxUniformBlockNameLength = 0;
  program.uniformIdCounter = 1;
  GL.programs[id] = program;
  return id;
};

_glCreateProgram.sig = "i";

var _glCreateShader = shaderType => {
  var id = GL.getNewId(GL.shaders);
  GL.shaders[id] = GLctx.createShader(shaderType);
  return id;
};

_glCreateShader.sig = "ii";

var _glCullFace = x0 => GLctx.cullFace(x0);

_glCullFace.sig = "vi";

function _glDeleteBuffers(n, buffers) {
  buffers >>>= 0;
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(((buffers) + (i * 4)) >>> 2) >>> 0];
    var buffer = GL.buffers[id];
    // From spec: "glDeleteBuffers silently ignores 0's and names that do not
    // correspond to existing buffer objects."
    if (!buffer) continue;
    GLctx.deleteBuffer(buffer);
    buffer.name = 0;
    GL.buffers[id] = null;
    if (id == GLctx.currentPixelPackBufferBinding) GLctx.currentPixelPackBufferBinding = 0;
    if (id == GLctx.currentPixelUnpackBufferBinding) GLctx.currentPixelUnpackBufferBinding = 0;
  }
}

_glDeleteBuffers.sig = "vip";

function _glDeleteFramebuffers(n, framebuffers) {
  framebuffers >>>= 0;
  for (var i = 0; i < n; ++i) {
    var id = HEAP32[(((framebuffers) + (i * 4)) >>> 2) >>> 0];
    var framebuffer = GL.framebuffers[id];
    if (!framebuffer) continue;
    // GL spec: "glDeleteFramebuffers silently ignores 0s and names that do not correspond to existing framebuffer objects".
    GLctx.deleteFramebuffer(framebuffer);
    framebuffer.name = 0;
    GL.framebuffers[id] = null;
  }
}

_glDeleteFramebuffers.sig = "vip";

var _glDeleteProgram = id => {
  if (!id) return;
  var program = GL.programs[id];
  if (!program) {
    // glDeleteProgram actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    return;
  }
  GLctx.deleteProgram(program);
  program.name = 0;
  GL.programs[id] = null;
};

_glDeleteProgram.sig = "vi";

function _glDeleteRenderbuffers(n, renderbuffers) {
  renderbuffers >>>= 0;
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(((renderbuffers) + (i * 4)) >>> 2) >>> 0];
    var renderbuffer = GL.renderbuffers[id];
    if (!renderbuffer) continue;
    // GL spec: "glDeleteRenderbuffers silently ignores 0s and names that do not correspond to existing renderbuffer objects".
    GLctx.deleteRenderbuffer(renderbuffer);
    renderbuffer.name = 0;
    GL.renderbuffers[id] = null;
  }
}

_glDeleteRenderbuffers.sig = "vip";

var _glDeleteShader = id => {
  if (!id) return;
  var shader = GL.shaders[id];
  if (!shader) {
    // glDeleteShader actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    return;
  }
  GLctx.deleteShader(shader);
  GL.shaders[id] = null;
};

_glDeleteShader.sig = "vi";

function _glDeleteTextures(n, textures) {
  textures >>>= 0;
  for (var i = 0; i < n; i++) {
    var id = HEAP32[(((textures) + (i * 4)) >>> 2) >>> 0];
    var texture = GL.textures[id];
    // GL spec: "glDeleteTextures silently ignores 0s and names that do not
    // correspond to existing textures".
    if (!texture) continue;
    GLctx.deleteTexture(texture);
    texture.name = 0;
    GL.textures[id] = null;
  }
}

_glDeleteTextures.sig = "vip";

var _glDepthFunc = x0 => GLctx.depthFunc(x0);

_glDepthFunc.sig = "vi";

var _glDepthMask = flag => {
  GLctx.depthMask(!!flag);
};

_glDepthMask.sig = "vi";

var _glDetachShader = (program, shader) => {
  GLctx.detachShader(GL.programs[program], GL.shaders[shader]);
};

_glDetachShader.sig = "vii";

var _glDisable = x0 => GLctx.disable(x0);

_glDisable.sig = "vi";

var _glDisableVertexAttribArray = index => {
  GLctx.disableVertexAttribArray(index);
};

_glDisableVertexAttribArray.sig = "vi";

var _glDrawArrays = (mode, first, count) => {
  GLctx.drawArrays(mode, first, count);
};

_glDrawArrays.sig = "viii";

var _glDrawArraysInstanced = (mode, first, count, primcount) => {
  GLctx.drawArraysInstanced(mode, first, count, primcount);
};

_glDrawArraysInstanced.sig = "viiii";

function _glDrawElements(mode, count, type, indices) {
  indices >>>= 0;
  GLctx.drawElements(mode, count, type, indices);
}

_glDrawElements.sig = "viiip";

function _glDrawElementsInstanced(mode, count, type, indices, primcount) {
  indices >>>= 0;
  GLctx.drawElementsInstanced(mode, count, type, indices, primcount);
}

_glDrawElementsInstanced.sig = "viiipi";

var _glEnable = x0 => GLctx.enable(x0);

_glEnable.sig = "vi";

var _glEnableVertexAttribArray = index => {
  GLctx.enableVertexAttribArray(index);
};

_glEnableVertexAttribArray.sig = "vi";

var _glFramebufferRenderbuffer = (target, attachment, renderbuffertarget, renderbuffer) => {
  GLctx.framebufferRenderbuffer(target, attachment, renderbuffertarget, GL.renderbuffers[renderbuffer]);
};

_glFramebufferRenderbuffer.sig = "viiii";

var _glFramebufferTexture2D = (target, attachment, textarget, texture, level) => {
  GLctx.framebufferTexture2D(target, attachment, textarget, GL.textures[texture], level);
};

_glFramebufferTexture2D.sig = "viiiii";

function _glGenBuffers(n, buffers) {
  buffers >>>= 0;
  GL.genObject(n, buffers, "createBuffer", GL.buffers);
}

_glGenBuffers.sig = "vip";

function _glGenFramebuffers(n, ids) {
  ids >>>= 0;
  GL.genObject(n, ids, "createFramebuffer", GL.framebuffers);
}

_glGenFramebuffers.sig = "vip";

function _glGenRenderbuffers(n, renderbuffers) {
  renderbuffers >>>= 0;
  GL.genObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers);
}

_glGenRenderbuffers.sig = "vip";

function _glGenTextures(n, textures) {
  textures >>>= 0;
  GL.genObject(n, textures, "createTexture", GL.textures);
}

_glGenTextures.sig = "vip";

var _glGenerateMipmap = x0 => GLctx.generateMipmap(x0);

_glGenerateMipmap.sig = "vi";

function _glGetAttribLocation(program, name) {
  name >>>= 0;
  return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
}

_glGetAttribLocation.sig = "iip";

var writeI53ToI64 = (ptr, num) => {
  HEAPU32[((ptr) >>> 2) >>> 0] = num;
  var lower = HEAPU32[((ptr) >>> 2) >>> 0];
  HEAPU32[(((ptr) + (4)) >>> 2) >>> 0] = (num - lower) / 4294967296;
};

var webglGetExtensions = () => {
  var exts = getEmscriptenSupportedExtensions(GLctx);
  exts = exts.concat(exts.map(e => "GL_" + e));
  return exts;
};

var emscriptenWebGLGet = (name_, p, type) => {
  // Guard against user passing a null pointer.
  // Note that GLES2 spec does not say anything about how passing a null
  // pointer should be treated.  Testing on desktop core GL 3, the application
  // crashes on glGetIntegerv to a null pointer, but better to report an error
  // instead of doing anything random.
  if (!p) {
    GL.recordError(1281);
    return;
  }
  var ret = undefined;
  switch (name_) {
   // Handle a few trivial GLES values
    case 36346:
    // GL_SHADER_COMPILER
    ret = 1;
    break;

   case 36344:
    // GL_SHADER_BINARY_FORMATS
    if (type != 0 && type != 1) {
      GL.recordError(1280);
    }
    // Do not write anything to the out pointer, since no binary formats are
    // supported.
    return;

   case 34814:
   // GL_NUM_PROGRAM_BINARY_FORMATS
    case 36345:
    // GL_NUM_SHADER_BINARY_FORMATS
    ret = 0;
    break;

   case 34466:
    // GL_NUM_COMPRESSED_TEXTURE_FORMATS
    // WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete
    // since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be
    // queried for length), so implement it ourselves to allow C++ GLES2
    // code get the length.
    var formats = GLctx.getParameter(34467);
    ret = formats ? formats.length : 0;
    break;

   case 33309:
    // GL_NUM_EXTENSIONS
    if (GL.currentContext.version < 2) {
      // Calling GLES3/WebGL2 function with a GLES2/WebGL1 context
      GL.recordError(1282);
      return;
    }
    ret = webglGetExtensions().length;
    break;

   case 33307:
   // GL_MAJOR_VERSION
    case 33308:
    // GL_MINOR_VERSION
    if (GL.currentContext.version < 2) {
      GL.recordError(1280);
      // GL_INVALID_ENUM
      return;
    }
    ret = name_ == 33307 ? 3 : 0;
    // return version 3.0
    break;
  }
  if (ret === undefined) {
    var result = GLctx.getParameter(name_);
    switch (typeof result) {
     case "number":
      ret = result;
      break;

     case "boolean":
      ret = result ? 1 : 0;
      break;

     case "string":
      GL.recordError(1280);
      // GL_INVALID_ENUM
      return;

     case "object":
      if (result === null) {
        // null is a valid result for some (e.g., which buffer is bound -
        // perhaps nothing is bound), but otherwise can mean an invalid
        // name_, which we need to report as an error
        switch (name_) {
         case 34964:
         // ARRAY_BUFFER_BINDING
          case 35725:
         // CURRENT_PROGRAM
          case 34965:
         // ELEMENT_ARRAY_BUFFER_BINDING
          case 36006:
         // FRAMEBUFFER_BINDING or DRAW_FRAMEBUFFER_BINDING
          case 36007:
         // RENDERBUFFER_BINDING
          case 32873:
         // TEXTURE_BINDING_2D
          case 34229:
         // WebGL 2 GL_VERTEX_ARRAY_BINDING, or WebGL 1 extension OES_vertex_array_object GL_VERTEX_ARRAY_BINDING_OES
          case 36662:
         // COPY_READ_BUFFER_BINDING or COPY_READ_BUFFER
          case 36663:
         // COPY_WRITE_BUFFER_BINDING or COPY_WRITE_BUFFER
          case 35053:
         // PIXEL_PACK_BUFFER_BINDING
          case 35055:
         // PIXEL_UNPACK_BUFFER_BINDING
          case 36010:
         // READ_FRAMEBUFFER_BINDING
          case 35097:
         // SAMPLER_BINDING
          case 35869:
         // TEXTURE_BINDING_2D_ARRAY
          case 32874:
         // TEXTURE_BINDING_3D
          case 36389:
         // TRANSFORM_FEEDBACK_BINDING
          case 35983:
         // TRANSFORM_FEEDBACK_BUFFER_BINDING
          case 35368:
         // UNIFORM_BUFFER_BINDING
          case 34068:
          {
            // TEXTURE_BINDING_CUBE_MAP
            ret = 0;
            break;
          }

         default:
          {
            GL.recordError(1280);
            // GL_INVALID_ENUM
            return;
          }
        }
      } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
        for (var i = 0; i < result.length; ++i) {
          switch (type) {
           case 0:
            HEAP32[(((p) + (i * 4)) >>> 2) >>> 0] = result[i];
            break;

           case 2:
            HEAPF32[(((p) + (i * 4)) >>> 2) >>> 0] = result[i];
            break;

           case 4:
            HEAP8[(p) + (i) >>> 0] = result[i] ? 1 : 0;
            break;
          }
        }
        return;
      } else {
        try {
          ret = result.name | 0;
        } catch (e) {
          GL.recordError(1280);
          // GL_INVALID_ENUM
          err(`GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`);
          return;
        }
      }
      break;

     default:
      GL.recordError(1280);
      // GL_INVALID_ENUM
      err(`GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof (result)}!`);
      return;
    }
  }
  switch (type) {
   case 1:
    writeI53ToI64(p, ret);
    break;

   case 0:
    HEAP32[((p) >>> 2) >>> 0] = ret;
    break;

   case 2:
    HEAPF32[((p) >>> 2) >>> 0] = ret;
    break;

   case 4:
    HEAP8[p >>> 0] = ret ? 1 : 0;
    break;
  }
};

function _glGetBooleanv(name_, p) {
  p >>>= 0;
  return emscriptenWebGLGet(name_, p, 4);
}

_glGetBooleanv.sig = "vip";

function _glGetIntegerv(name_, p) {
  p >>>= 0;
  return emscriptenWebGLGet(name_, p, 0);
}

_glGetIntegerv.sig = "vip";

function _glGetProgramInfoLog(program, maxLength, length, infoLog) {
  length >>>= 0;
  infoLog >>>= 0;
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) HEAP32[((length) >>> 2) >>> 0] = numBytesWrittenExclNull;
}

_glGetProgramInfoLog.sig = "viipp";

function _glGetProgramiv(program, pname, p) {
  p >>>= 0;
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  if (program >= GL.counter) {
    GL.recordError(1281);
    return;
  }
  program = GL.programs[program];
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getProgramInfoLog(program);
    if (log === null) log = "(unknown error)";
    HEAP32[((p) >>> 2) >>> 0] = log.length + 1;
  } else if (pname == 35719) {
    if (!program.maxUniformLength) {
      var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
      for (var i = 0; i < numActiveUniforms; ++i) {
        program.maxUniformLength = Math.max(program.maxUniformLength, GLctx.getActiveUniform(program, i).name.length + 1);
      }
    }
    HEAP32[((p) >>> 2) >>> 0] = program.maxUniformLength;
  } else if (pname == 35722) {
    if (!program.maxAttributeLength) {
      var numActiveAttributes = GLctx.getProgramParameter(program, 35721);
      for (var i = 0; i < numActiveAttributes; ++i) {
        program.maxAttributeLength = Math.max(program.maxAttributeLength, GLctx.getActiveAttrib(program, i).name.length + 1);
      }
    }
    HEAP32[((p) >>> 2) >>> 0] = program.maxAttributeLength;
  } else if (pname == 35381) {
    if (!program.maxUniformBlockNameLength) {
      var numActiveUniformBlocks = GLctx.getProgramParameter(program, 35382);
      for (var i = 0; i < numActiveUniformBlocks; ++i) {
        program.maxUniformBlockNameLength = Math.max(program.maxUniformBlockNameLength, GLctx.getActiveUniformBlockName(program, i).length + 1);
      }
    }
    HEAP32[((p) >>> 2) >>> 0] = program.maxUniformBlockNameLength;
  } else {
    HEAP32[((p) >>> 2) >>> 0] = GLctx.getProgramParameter(program, pname);
  }
}

_glGetProgramiv.sig = "viip";

function _glGetShaderInfoLog(shader, maxLength, length, infoLog) {
  length >>>= 0;
  infoLog >>>= 0;
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) HEAP32[((length) >>> 2) >>> 0] = numBytesWrittenExclNull;
}

_glGetShaderInfoLog.sig = "viipp";

function _glGetShaderPrecisionFormat(shaderType, precisionType, range, precision) {
  range >>>= 0;
  precision >>>= 0;
  var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
  HEAP32[((range) >>> 2) >>> 0] = result.rangeMin;
  HEAP32[(((range) + (4)) >>> 2) >>> 0] = result.rangeMax;
  HEAP32[((precision) >>> 2) >>> 0] = result.precision;
}

_glGetShaderPrecisionFormat.sig = "viipp";

function _glGetShaderiv(shader, pname, p) {
  p >>>= 0;
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null) log = "(unknown error)";
    // The GLES2 specification says that if the shader has an empty info log,
    // a value of 0 is returned. Otherwise the log has a null char appended.
    // (An empty string is falsey, so we can just check that instead of
    // looking at log.length.)
    var logLength = log ? log.length + 1 : 0;
    HEAP32[((p) >>> 2) >>> 0] = logLength;
  } else if (pname == 35720) {
    // GL_SHADER_SOURCE_LENGTH
    var source = GLctx.getShaderSource(GL.shaders[shader]);
    // source may be a null, or the empty string, both of which are falsey
    // values that we report a 0 length for.
    var sourceLength = source ? source.length + 1 : 0;
    HEAP32[((p) >>> 2) >>> 0] = sourceLength;
  } else {
    HEAP32[((p) >>> 2) >>> 0] = GLctx.getShaderParameter(GL.shaders[shader], pname);
  }
}

_glGetShaderiv.sig = "viip";

var stringToNewUTF8 = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8(str, ret, size);
  return ret;
};

function _glGetString(name_) {
  var ret = GL.stringCache[name_];
  if (!ret) {
    switch (name_) {
     case 7939:
      ret = stringToNewUTF8(webglGetExtensions().join(" "));
      break;

     case 7936:
     case 7937:
     case 37445:
     case 37446:
      var s = GLctx.getParameter(name_);
      if (!s) {
        GL.recordError(1280);
      }
      ret = s ? stringToNewUTF8(s) : 0;
      break;

     case 7938:
      var webGLVersion = GLctx.getParameter(7938);
      // return GLES version string corresponding to the version of the WebGL context
      var glVersion = `OpenGL ES 2.0 (${webGLVersion})`;
      if (GL.currentContext.version >= 2) glVersion = `OpenGL ES 3.0 (${webGLVersion})`;
      ret = stringToNewUTF8(glVersion);
      break;

     case 35724:
      var glslVersion = GLctx.getParameter(35724);
      // extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
      var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
      var ver_num = glslVersion.match(ver_re);
      if (ver_num !== null) {
        if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + "0";
        // ensure minor version has 2 digits
        glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`;
      }
      ret = stringToNewUTF8(glslVersion);
      break;

     default:
      GL.recordError(1280);
    }
    GL.stringCache[name_] = ret;
  }
  return ret;
}

_glGetString.sig = "pi";

/** @suppress {checkTypes} */ var jstoi_q = str => parseInt(str);

/** @noinline */ var webglGetLeftBracePos = name => name.slice(-1) == "]" && name.lastIndexOf("[");

var webglPrepareUniformLocationsBeforeFirstUse = program => {
  var uniformLocsById = program.uniformLocsById, // Maps GLuint -> WebGLUniformLocation
  uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, // Maps name -> [uniform array length, GLuint]
  i, j;
  // On the first time invocation of glGetUniformLocation on this shader program:
  // initialize cache data structures and discover which uniforms are arrays.
  if (!uniformLocsById) {
    // maps GLint integer locations to WebGLUniformLocations
    program.uniformLocsById = uniformLocsById = {};
    // maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
    program.uniformArrayNamesById = {};
    var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
    for (i = 0; i < numActiveUniforms; ++i) {
      var u = GLctx.getActiveUniform(program, i);
      var nm = u.name;
      var sz = u.size;
      var lb = webglGetLeftBracePos(nm);
      var arrayName = lb > 0 ? nm.slice(0, lb) : nm;
      // Assign a new location.
      var id = program.uniformIdCounter;
      program.uniformIdCounter += sz;
      // Eagerly get the location of the uniformArray[0] base element.
      // The remaining indices >0 will be left for lazy evaluation to
      // improve performance. Those may never be needed to fetch, if the
      // application fills arrays always in full starting from the first
      // element of the array.
      uniformSizeAndIdsByName[arrayName] = [ sz, id ];
      // Store placeholder integers in place that highlight that these
      // >0 index locations are array indices pending population.
      for (j = 0; j < sz; ++j) {
        uniformLocsById[id] = j;
        program.uniformArrayNamesById[id++] = arrayName;
      }
    }
  }
};

function _glGetUniformLocation(program, name) {
  name >>>= 0;
  name = UTF8ToString(name);
  if (program = GL.programs[program]) {
    webglPrepareUniformLocationsBeforeFirstUse(program);
    var uniformLocsById = program.uniformLocsById;
    // Maps GLuint -> WebGLUniformLocation
    var arrayIndex = 0;
    var uniformBaseName = name;
    // Invariant: when populating integer IDs for uniform locations, we must
    // maintain the precondition that arrays reside in contiguous addresses,
    // i.e. for a 'vec4 colors[10];', colors[4] must be at location
    // colors[0]+4.  However, user might call glGetUniformLocation(program,
    // "colors") for an array, so we cannot discover based on the user input
    // arguments whether the uniform we are dealing with is an array. The only
    // way to discover which uniforms are arrays is to enumerate over all the
    // active uniforms in the program.
    var leftBrace = webglGetLeftBracePos(name);
    // If user passed an array accessor "[index]", parse the array index off the accessor.
    if (leftBrace > 0) {
      arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0;
      // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
      uniformBaseName = name.slice(0, leftBrace);
    }
    // Have we cached the location of this uniform before?
    // A pair [array length, GLint of the uniform location]
    var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName];
    // If an uniform with this name exists, and if its index is within the
    // array limits (if it's even an array), query the WebGLlocation, or
    // return an existing cached location.
    if (sizeAndId && arrayIndex < sizeAndId[0]) {
      arrayIndex += sizeAndId[1];
      // Add the base location of the uniform to the array index offset.
      if ((uniformLocsById[arrayIndex] = uniformLocsById[arrayIndex] || GLctx.getUniformLocation(program, name))) {
        return arrayIndex;
      }
    }
  } else {
    // N.b. we are currently unable to distinguish between GL program IDs that
    // never existed vs GL program IDs that have been deleted, so report
    // GL_INVALID_VALUE in both cases.
    GL.recordError(1281);
  }
  return -1;
}

_glGetUniformLocation.sig = "iip";

var _glIsProgram = program => {
  program = GL.programs[program];
  if (!program) return 0;
  return GLctx.isProgram(program);
};

_glIsProgram.sig = "ii";

var _glIsRenderbuffer = renderbuffer => {
  var rb = GL.renderbuffers[renderbuffer];
  if (!rb) return 0;
  return GLctx.isRenderbuffer(rb);
};

_glIsRenderbuffer.sig = "ii";

var _glIsShader = shader => {
  var s = GL.shaders[shader];
  if (!s) return 0;
  return GLctx.isShader(s);
};

_glIsShader.sig = "ii";

var _glLinkProgram = program => {
  program = GL.programs[program];
  GLctx.linkProgram(program);
  // Invalidate earlier computed uniform->ID mappings, those have now become stale
  program.uniformLocsById = 0;
  // Mark as null-like so that glGetUniformLocation() knows to populate this again.
  program.uniformSizeAndIdsByName = {};
};

_glLinkProgram.sig = "vi";

var _glPixelStorei = (pname, param) => {
  if (pname == 3317) {
    GL.unpackAlignment = param;
  } else if (pname == 3314) {
    GL.unpackRowLength = param;
  }
  GLctx.pixelStorei(pname, param);
};

_glPixelStorei.sig = "vii";

var computeUnpackAlignedImageSize = (width, height, sizePerPixel) => {
  function roundedToNextMultipleOf(x, y) {
    return (x + y - 1) & -y;
  }
  var plainRowSize = (GL.unpackRowLength || width) * sizePerPixel;
  var alignedRowSize = roundedToNextMultipleOf(plainRowSize, GL.unpackAlignment);
  return height * alignedRowSize;
};

var colorChannelsInGlTextureFormat = format => {
  // Micro-optimizations for size: map format to size by subtracting smallest
  // enum value (0x1902) from all values first.  Also omit the most common
  // size value (1) from the list, which is assumed by formats not on the
  // list.
  var colorChannels = {
    // 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
    // 0x1906 /* GL_ALPHA */ - 0x1902: 1,
    5: 3,
    6: 4,
    // 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
    8: 2,
    29502: 3,
    29504: 4,
    // 0x1903 /* GL_RED */ - 0x1902: 1,
    26917: 2,
    26918: 2,
    // 0x8D94 /* GL_RED_INTEGER */ - 0x1902: 1,
    29846: 3,
    29847: 4
  };
  return colorChannels[format - 6402] || 1;
};

var heapObjectForWebGLType = type => {
  // Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
  // smaller values for the heap, for shorter generated code size.
  // Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
  // (since most types are HEAPU16)
  type -= 5120;
  if (type == 0) return HEAP8;
  if (type == 1) return HEAPU8;
  if (type == 2) return HEAP16;
  if (type == 4) return HEAP32;
  if (type == 6) return HEAPF32;
  if (type == 5 || type == 28922 || type == 28520 || type == 30779 || type == 30782) return HEAPU32;
  return HEAPU16;
};

var toTypedArrayIndex = (pointer, heap) => pointer >>> (31 - Math.clz32(heap.BYTES_PER_ELEMENT));

var emscriptenWebGLGetTexPixelData = (type, format, width, height, pixels, internalFormat) => {
  var heap = heapObjectForWebGLType(type);
  var sizePerPixel = colorChannelsInGlTextureFormat(format) * heap.BYTES_PER_ELEMENT;
  var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel);
  return heap.subarray(toTypedArrayIndex(pixels, heap) >>> 0, toTypedArrayIndex(pixels + bytes, heap) >>> 0);
};

function _glReadPixels(x, y, width, height, format, type, pixels) {
  pixels >>>= 0;
  if (GL.currentContext.version >= 2) {
    if (GLctx.currentPixelPackBufferBinding) {
      GLctx.readPixels(x, y, width, height, format, type, pixels);
      return;
    }
  }
  var pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, format);
  if (!pixelData) {
    GL.recordError(1280);
    return;
  }
  GLctx.readPixels(x, y, width, height, format, type, pixelData);
}

_glReadPixels.sig = "viiiiiip";

var _glRenderbufferStorage = (x0, x1, x2, x3) => GLctx.renderbufferStorage(x0, x1, x2, x3);

_glRenderbufferStorage.sig = "viiii";

var _glScissor = (x0, x1, x2, x3) => GLctx.scissor(x0, x1, x2, x3);

_glScissor.sig = "viiii";

function _glShaderSource(shader, count, string, length) {
  string >>>= 0;
  length >>>= 0;
  var source = GL.getSource(shader, count, string, length);
  GLctx.shaderSource(GL.shaders[shader], source);
}

_glShaderSource.sig = "viipp";

var _glStencilFunc = (x0, x1, x2) => GLctx.stencilFunc(x0, x1, x2);

_glStencilFunc.sig = "viii";

var _glStencilMask = x0 => GLctx.stencilMask(x0);

_glStencilMask.sig = "vi";

var _glStencilOp = (x0, x1, x2) => GLctx.stencilOp(x0, x1, x2);

_glStencilOp.sig = "viii";

function _glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
  pixels >>>= 0;
  if (GL.currentContext.version >= 2) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels);
      return;
    }
  }
  var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null;
  GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixelData);
}

_glTexImage2D.sig = "viiiiiiiip";

var _glTexParameteri = (x0, x1, x2) => GLctx.texParameteri(x0, x1, x2);

_glTexParameteri.sig = "viii";

var webglGetUniformLocation = location => {
  var p = GLctx.currentProgram;
  if (p) {
    var webglLoc = p.uniformLocsById[location];
    // p.uniformLocsById[location] stores either an integer, or a
    // WebGLUniformLocation.
    // If an integer, we have not yet bound the location, so do it now. The
    // integer value specifies the array index we should bind to.
    if (typeof webglLoc == "number") {
      p.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(p, p.uniformArrayNamesById[location] + (webglLoc > 0 ? `[${webglLoc}]` : ""));
    }
    // Else an already cached WebGLUniformLocation, return it.
    return webglLoc;
  } else {
    GL.recordError(1282);
  }
};

var miniTempWebGLFloatBuffers = [];

function _glUniform1fv(location, count, value) {
  value >>>= 0;
  if (count <= 288) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; ++i) {
      view[i] = HEAPF32[(((value) + (4 * i)) >>> 2) >>> 0];
    }
  } else {
    var view = HEAPF32.subarray((((value) >>> 2)) >>> 0, ((value + count * 4) >>> 2) >>> 0);
  }
  GLctx.uniform1fv(webglGetUniformLocation(location), view);
}

_glUniform1fv.sig = "viip";

var _glUniform1i = (location, v0) => {
  GLctx.uniform1i(webglGetUniformLocation(location), v0);
};

_glUniform1i.sig = "vii";

var miniTempWebGLIntBuffers = [];

function _glUniform1iv(location, count, value) {
  value >>>= 0;
  if (count <= 288) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLIntBuffers[count];
    for (var i = 0; i < count; ++i) {
      view[i] = HEAP32[(((value) + (4 * i)) >>> 2) >>> 0];
    }
  } else {
    var view = HEAP32.subarray((((value) >>> 2)) >>> 0, ((value + count * 4) >>> 2) >>> 0);
  }
  GLctx.uniform1iv(webglGetUniformLocation(location), view);
}

_glUniform1iv.sig = "viip";

function _glUniform2fv(location, count, value) {
  value >>>= 0;
  if (count <= 144) {
    // avoid allocation when uploading few enough uniforms
    count *= 2;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 2) {
      view[i] = HEAPF32[(((value) + (4 * i)) >>> 2) >>> 0];
      view[i + 1] = HEAPF32[(((value) + (4 * i + 4)) >>> 2) >>> 0];
    }
  } else {
    var view = HEAPF32.subarray((((value) >>> 2)) >>> 0, ((value + count * 8) >>> 2) >>> 0);
  }
  GLctx.uniform2fv(webglGetUniformLocation(location), view);
}

_glUniform2fv.sig = "viip";

function _glUniform3fv(location, count, value) {
  value >>>= 0;
  if (count <= 96) {
    // avoid allocation when uploading few enough uniforms
    count *= 3;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 3) {
      view[i] = HEAPF32[(((value) + (4 * i)) >>> 2) >>> 0];
      view[i + 1] = HEAPF32[(((value) + (4 * i + 4)) >>> 2) >>> 0];
      view[i + 2] = HEAPF32[(((value) + (4 * i + 8)) >>> 2) >>> 0];
    }
  } else {
    var view = HEAPF32.subarray((((value) >>> 2)) >>> 0, ((value + count * 12) >>> 2) >>> 0);
  }
  GLctx.uniform3fv(webglGetUniformLocation(location), view);
}

_glUniform3fv.sig = "viip";

function _glUniform4fv(location, count, value) {
  value >>>= 0;
  if (count <= 72) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[4 * count];
    // hoist the heap out of the loop for size and for pthreads+growth.
    var heap = HEAPF32;
    value = ((value) >>> 2);
    count *= 4;
    for (var i = 0; i < count; i += 4) {
      var dst = value + i;
      view[i] = heap[dst >>> 0];
      view[i + 1] = heap[dst + 1 >>> 0];
      view[i + 2] = heap[dst + 2 >>> 0];
      view[i + 3] = heap[dst + 3 >>> 0];
    }
  } else {
    var view = HEAPF32.subarray((((value) >>> 2)) >>> 0, ((value + count * 16) >>> 2) >>> 0);
  }
  GLctx.uniform4fv(webglGetUniformLocation(location), view);
}

_glUniform4fv.sig = "viip";

function _glUniformMatrix4fv(location, count, transpose, value) {
  value >>>= 0;
  if (count <= 18) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[16 * count];
    // hoist the heap out of the loop for size and for pthreads+growth.
    var heap = HEAPF32;
    value = ((value) >>> 2);
    count *= 16;
    for (var i = 0; i < count; i += 16) {
      var dst = value + i;
      view[i] = heap[dst >>> 0];
      view[i + 1] = heap[dst + 1 >>> 0];
      view[i + 2] = heap[dst + 2 >>> 0];
      view[i + 3] = heap[dst + 3 >>> 0];
      view[i + 4] = heap[dst + 4 >>> 0];
      view[i + 5] = heap[dst + 5 >>> 0];
      view[i + 6] = heap[dst + 6 >>> 0];
      view[i + 7] = heap[dst + 7 >>> 0];
      view[i + 8] = heap[dst + 8 >>> 0];
      view[i + 9] = heap[dst + 9 >>> 0];
      view[i + 10] = heap[dst + 10 >>> 0];
      view[i + 11] = heap[dst + 11 >>> 0];
      view[i + 12] = heap[dst + 12 >>> 0];
      view[i + 13] = heap[dst + 13 >>> 0];
      view[i + 14] = heap[dst + 14 >>> 0];
      view[i + 15] = heap[dst + 15 >>> 0];
    }
  } else {
    var view = HEAPF32.subarray((((value) >>> 2)) >>> 0, ((value + count * 64) >>> 2) >>> 0);
  }
  GLctx.uniformMatrix4fv(webglGetUniformLocation(location), !!transpose, view);
}

_glUniformMatrix4fv.sig = "viiip";

var _glUseProgram = program => {
  program = GL.programs[program];
  GLctx.useProgram(program);
  // Record the currently active program so that we can access the uniform
  // mapping table of that program.
  GLctx.currentProgram = program;
};

_glUseProgram.sig = "vi";

var _glVertexAttribDivisor = (index, divisor) => {
  GLctx.vertexAttribDivisor(index, divisor);
};

_glVertexAttribDivisor.sig = "vii";

function _glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
  ptr >>>= 0;
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}

_glVertexAttribPointer.sig = "viiiiip";

var _glViewport = (x0, x1, x2, x3) => GLctx.viewport(x0, x1, x2, x3);

_glViewport.sig = "viiii";

var WebXR = {
  refSpaces: {},
  _curRAF: null,
  _nativize_vec3: function(offset, vec) {
    setValue(offset + 0, vec.x, "float");
    setValue(offset + 4, vec.y, "float");
    setValue(offset + 8, vec.z, "float");
    return offset + 12;
  },
  _nativize_vec4: function(offset, vec) {
    WebXR._nativize_vec3(offset, vec);
    setValue(offset + 12, vec.w, "float");
    return offset + 16;
  },
  _nativize_matrix: function(offset, mat) {
    for (var i = 0; i < 16; ++i) {
      setValue(offset + i * 4, mat[i], "float");
    }
    return offset + 16 * 4;
  },
  _nativize_rigid_transform: function(offset, t) {
    offset = WebXR._nativize_matrix(offset, t.matrix);
    offset = WebXR._nativize_vec3(offset, t.position);
    offset = WebXR._nativize_vec4(offset, t.orientation);
    return offset;
  },
  _nativize_input_source: function(offset, inputSource, id) {
    var handedness = -1;
    if (inputSource.handedness == "left") handedness = 0; else if (inputSource.handedness == "right") handedness = 1;
    var targetRayMode = 0;
    if (inputSource.targetRayMode == "tracked-pointer") targetRayMode = 1; else if (inputSource.targetRayMode == "screen") targetRayMode = 2;
    setValue(offset, id, "i32");
    offset += 4;
    setValue(offset, handedness, "i32");
    offset += 4;
    setValue(offset, targetRayMode, "i32");
    offset += 4;
    return offset;
  },
  _set_input_callback__deps: [ "$dynCall" ],
  _set_input_callback: function(event, callback, userData) {
    var s = Module["webxr_session"];
    if (!s) return;
    if (!callback) return;
    s.addEventListener(event, function(e) {
      /* Nativize input source */ var inputSource = Module._malloc(8);
      /* 2*sizeof(int32) */ WebXR._nativize_input_source(inputSource, e.inputSource, i);
      /* Call native callback */ dynCall("vii", callback, [ inputSource, userData ]);
      _free(inputSource);
    });
  },
  _set_session_callback__deps: [ "$dynCall" ],
  _set_session_callback: function(event, callback, userData) {
    var s = Module["webxr_session"];
    if (!s) return;
    if (!callback) return;
    s.addEventListener(event, function() {
      dynCall("vi", callback, [ userData ]);
    });
  }
};

function _webxr_get_input_pose(source, outPosePtr, space) {
  let f = Module["webxr_frame"];
  if (!f) {
    console.warn("Cannot call webxr_get_input_pose outside of frame callback");
    return false;
  }
  const id = getValue(source, "i32");
  const input = Module["webxr_session"].inputSources[id];
  const s = space == 0 ? input.gripSpace : input.targetRaySpace;
  if (!s) return false;
  const pose = f.getPose(s, WebXR.refSpaces[WebXR.refSpace]);
  if (!pose || Number.isNaN(pose.transform.matrix[0])) return false;
  WebXR._nativize_rigid_transform(outPosePtr, pose.transform);
  return true;
}

function _webxr_get_input_sources(outArrayPtr, max, outCountPtr) {
  let s = Module["webxr_session"];
  if (!s) return;
  // TODO(squareys) warning or return error
  let i = 0;
  for (let inputSource of s.inputSources) {
    if (i >= max) break;
    outArrayPtr = WebXR._nativize_input_source(outArrayPtr, inputSource, i);
    ++i;
  }
  setValue(outCountPtr, i, "i32");
}

var dynCall = (sig, ptr, args = [], promising = false) => {
  var func = getWasmTableEntry(ptr);
  var rtn = func(...args);
  function convert(rtn) {
    return sig[0] == "p" ? rtn >>> 0 : rtn;
  }
  return convert(rtn);
};

function _webxr_init(frameCallback, startSessionCallback, endSessionCallback, errorCallback, userData) {
  function onError(errorCode) {
    if (!errorCallback) return;
    dynCall("vii", errorCallback, [ userData, errorCode ]);
  }
  function onSessionEnd(mode) {
    if (!endSessionCallback) return;
    mode = {
      "inline": 0,
      "immersive-vr": 1,
      "immersive-ar": 2
    }[mode];
    dynCall("vii", endSessionCallback, [ userData, mode ]);
  }
  function onSessionStart(mode) {
    if (!startSessionCallback) return;
    mode = {
      "inline": 0,
      "immersive-vr": 1,
      "immersive-ar": 2
    }[mode];
    dynCall("vii", startSessionCallback, [ userData, mode ]);
  }
  const SIZE_OF_WEBXR_VIEW = (16 + 3 + 4 + 16 + 4) * 4;
  const views = Module._malloc(SIZE_OF_WEBXR_VIEW * 2 + (16 + 4 + 3) * 4);
  function onFrame(time, frame) {
    if (!frameCallback) return;
    /* Request next frame */ const session = frame.session;
    /* RAF is set to null on session end to avoid rendering */ if (Module["webxr_session"] != null) session.requestAnimationFrame(onFrame);
    const pose = frame.getViewerPose(WebXR.refSpaces[WebXR.refSpace]);
    if (!pose) return;
    const glLayer = session.renderState.baseLayer;
    pose.views.forEach(function(view) {
      const viewport = glLayer.getViewport(view);
      let offset = views + SIZE_OF_WEBXR_VIEW * (view.eye == "right" ? 1 : 0);
      offset = WebXR._nativize_rigid_transform(offset, view.transform);
      offset = WebXR._nativize_matrix(offset, view.projectionMatrix);
      setValue(offset + 0, viewport.x, "i32");
      setValue(offset + 4, viewport.y, "i32");
      setValue(offset + 8, viewport.width, "i32");
      setValue(offset + 12, viewport.height, "i32");
    });
    /* Model matrix */ const modelMatrix = views + SIZE_OF_WEBXR_VIEW * 2;
    WebXR._nativize_matrix(modelMatrix, pose.transform.matrix);
    /* If framebuffer is non-null, compositor is enabled and we bind it.
           * If it's null, we need to avoid this call otherwise the canvas FBO is bound */ if (glLayer.framebuffer) {
      /* Make sure that FRAMEBUFFER_BINDING returns a valid value.
               * For that we create an id in the emscripten object tables
               * and add the frambuffer */ const id = Module.webxr_fbo || GL.getNewId(GL.framebuffers);
      glLayer.framebuffer.name = id;
      GL.framebuffers[id] = glLayer.framebuffer;
      Module.webxr_fbo = id;
      Module.ctx.bindFramebuffer(Module.ctx.FRAMEBUFFER, glLayer.framebuffer);
    }
    /* Set and reset environment for webxr_get_input_pose calls */ Module["webxr_frame"] = frame;
    dynCall("viiiii", frameCallback, [ userData, time, modelMatrix, views, pose.views.length ]);
    Module["webxr_frame"] = null;
  }
  function onSessionStarted(session, mode) {
    Module["webxr_session"] = session;
    // React to session ending
    session.addEventListener("end", function() {
      Module["webxr_session"].cancelAnimationFrame(WebXR._curRAF);
      WebXR._curRAF = null;
      Module["webxr_session"] = null;
      onSessionEnd(mode);
    });
    // Ensure our context can handle WebXR rendering
    Module.ctx.makeXRCompatible().then(function() {
      // Create the base layer
      const layer = Module["webxr_baseLayer"] = new window.XRWebGLLayer(session, Module.ctx, {
        framebufferScaleFactor: Module["webxr_framebuffer_scale_factor"]
      });
      session.updateRenderState({
        baseLayer: layer
      });
      /* 'viewer' reference space is always available. */ session.requestReferenceSpace("viewer").then(refSpace => {
        WebXR.refSpaces["viewer"] = refSpace;
        WebXR.refSpace = "viewer";
        // Give application a chance to react to session starting
        // e.g. finish current desktop frame.
        onSessionStart(mode);
        // Start rendering
        session.requestAnimationFrame(onFrame);
      });
      /* Request and cache other available spaces, which may not be available */ for (const s of [ "local", "local-floor", "bounded-floor", "unbounded" ]) {
        session.requestReferenceSpace(s).then(refSpace => {
          /* We prefer the reference space automatically in above order */ WebXR.refSpace = s;
          WebXR.refSpaces[s] = refSpace;
        }, function() {});
      }
    }, function() {
      onError(-3);
    });
  }
  if (navigator.xr) {
    Module["webxr_request_session_func"] = function(mode, requiredFeatures, optionalFeatures) {
      if (typeof (mode) !== "string") {
        mode = ([ "inline", "immersive-vr", "immersive-ar" ])[mode];
      }
      let toFeatureList = function(bitMask) {
        const f = [];
        const features = [ "local", "local-floor", "bounded-floor", "unbounded", "hit-test" ];
        for (let i = 0; i < features.length; ++i) {
          if ((bitMask & (1 << i)) != 0) {
            f.push(features[i]);
          }
        }
        return features;
      };
      if (typeof (requiredFeatures) === "number") {
        requiredFeatures = toFeatureList(requiredFeatures);
      }
      if (typeof (optionalFeatures) === "number") {
        optionalFeatures = toFeatureList(optionalFeatures);
      }
      navigator.xr.requestSession(mode, {
        requiredFeatures,
        optionalFeatures
      }).then(function(s) {
        onSessionStarted(s, mode);
      }).catch(console.error);
    };
  } else {
    /* Call error callback with "WebXR not supported" */ onError(-2);
  }
}

function _webxr_request_exit() {
  var s = Module["webxr_session"];
  if (s) Module["webxr_session"].end();
}

function _webxr_request_session(mode) {
  var s = Module["webxr_request_session_func"];
  if (s) s(mode);
}

function _webxr_set_select_callback(callback, userData) {
  WebXR._set_input_callback("select", callback, userData);
}

function _webxr_set_select_end_callback(callback, userData) {
  WebXR._set_input_callback("selectend", callback, userData);
}

function _webxr_set_select_start_callback(callback, userData) {
  WebXR._set_input_callback("selectstart", callback, userData);
}

var getCFunc = ident => {
  var func = Module["_" + ident];
  // closure exported function
  return func;
};

var writeArrayToMemory = (array, buffer) => {
  HEAP8.set(array, buffer >>> 0);
};

/**
     * @param {string|null=} returnType
     * @param {Array=} argTypes
     * @param {Array=} args
     * @param {Object=} opts
     */ var ccall = (ident, returnType, argTypes, args, opts) => {
  // For fast lookup of conversion functions
  var toC = {
    "string": str => {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) {
        // null string
        ret = stringToUTF8OnStack(str);
      }
      return ret;
    },
    "array": arr => {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };
  function convertReturnValue(ret) {
    if (returnType === "string") {
      return UTF8ToString(ret);
    }
    if (returnType === "boolean") return Boolean(ret);
    return ret;
  }
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func(...cArgs);
  function onDone(ret) {
    if (stack !== 0) stackRestore(stack);
    return convertReturnValue(ret);
  }
  ret = onDone(ret);
  return ret;
};

/**
     * @param {string=} returnType
     * @param {Array=} argTypes
     * @param {Object=} opts
     */ var cwrap = (ident, returnType, argTypes, opts) => {
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = !argTypes || argTypes.every(type => type === "number" || type === "boolean");
  var numericRet = returnType !== "string";
  if (numericRet && numericArgs && !opts) {
    return getCFunc(ident);
  }
  return (...args) => ccall(ident, returnType, argTypes, args, opts);
};

var FS_createPath = (...args) => FS.createPath(...args);

var FS_unlink = (...args) => FS.unlink(...args);

var FS_createLazyFile = (...args) => FS.createLazyFile(...args);

var FS_createDevice = (...args) => FS.createDevice(...args);

var getTempRet0 = val => __emscripten_tempret_get();

var setTempRet0 = val => __emscripten_tempret_set(val);

registerWasmPlugin();

FS.createPreloadedFile = FS_createPreloadedFile;

FS.preloadFile = FS_preloadFile;

FS.staticInit();

Module["requestAnimationFrame"] = MainLoop.requestAnimationFrame;

Module["pauseMainLoop"] = MainLoop.pause;

Module["resumeMainLoop"] = MainLoop.resume;

MainLoop.init();

var miniTempWebGLFloatBuffersStorage = new Float32Array(288);

// Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
  miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(0, i);
}

var miniTempWebGLIntBuffersStorage = new Int32Array(288);

// Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
  miniTempWebGLIntBuffers[i] = miniTempWebGLIntBuffersStorage.subarray(0, i);
}

// End JS library code
// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.
{
  // With WASM_ESM_INTEGRATION this has to happen at the top level and not
  // delayed until processModuleArgs.
  initMemory();
  // Begin ATMODULES hooks
  if (Module["preloadPlugins"]) preloadPlugins = Module["preloadPlugins"];
  if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
  if (Module["print"]) out = Module["print"];
  if (Module["printErr"]) err = Module["printErr"];
  if (Module["dynamicLibraries"]) dynamicLibraries = Module["dynamicLibraries"];
  if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
  // End ATMODULES hooks
  if (Module["arguments"]) arguments_ = Module["arguments"];
  if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
  if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
    while (Module["preInit"].length > 0) {
      Module["preInit"].shift()();
    }
  }
}

// Begin runtime exports
Module["addRunDependency"] = addRunDependency;

Module["removeRunDependency"] = removeRunDependency;

Module["ccall"] = ccall;

Module["cwrap"] = cwrap;

Module["getValue"] = getValue;

Module["UTF8ToString"] = UTF8ToString;

Module["loadDynamicLibrary"] = loadDynamicLibrary;

Module["FS_preloadFile"] = FS_preloadFile;

Module["FS_unlink"] = FS_unlink;

Module["FS_createPath"] = FS_createPath;

Module["FS_createDevice"] = FS_createDevice;

Module["FS_createDataFile"] = FS_createDataFile;

Module["FS_createLazyFile"] = FS_createLazyFile;

// End runtime exports
// Begin JS library exports
Module["___assert_fail"] = ___assert_fail;

Module["___memory_base"] = ___memory_base;

Module["___stack_pointer"] = ___stack_pointer;

Module["___table_base"] = ___table_base;

Module["_exit"] = _exit;

Module["_getaddrinfo"] = _getaddrinfo;

Module["_getnameinfo"] = _getnameinfo;

Module["getTempRet0"] = getTempRet0;

Module["setTempRet0"] = setTempRet0;

// End JS library exports
// end include: postlibrary.js
var ASM_CONSTS = {
  383172: () => {
    if (GiderosNetplayerWS) GiderosNetplayerWS.close();
  },
  383228: () => {
    try {
      if (typeof GiderosNetplayerWSHost === "undefined") {
        GiderosNetplayerWSHost = "127.0.0.1";
      }
      if ((GiderosNetplayerWS == null) && (GiderosNetplayerWSHost != null)) {
        if (typeof MozWebSocket == "function") WebSocket = MozWebSocket;
        GiderosNetplayerWSQ = [];
        GiderosNetplayerWS = new WebSocket("ws://" + GiderosNetplayerWSHost + ":15001");
        GiderosNetplayerWS.binaryType = "arraybuffer";
        GiderosNetplayerWS.onmessage = function(evt) {
          GiderosNetplayerWSQ.push(evt.data);
        };
        GiderosNetplayerWS.onclose = function(evt) {
          GiderosNetplayerWS = null;
        };
        GiderosNetplayerWS.onerror = function(evt) {
          GiderosNetplayerWS = null;
        };
      }
    } catch (exception) {
      GiderosNetplayerWS = null;
    }
  },
  383902: () => {
    var buffer = 0;
    if (GiderosNetplayerWS != null) {
      var data = GiderosNetplayerWSQ.shift();
      if (data) {
        var byteArray = new Uint8Array(data);
        buffer = _malloc(byteArray.length);
        HEAPU8.set(byteArray, buffer >>> 0);
        GiderosNetplayerWSR = byteArray.length;
      }
    }
    return buffer;
  },
  384164: () => GiderosNetplayerWSR,
  384195: ($0, $1) => {
    Module["gnetplayerSend"](HEAPU8.subarray($0 >>> 0, $0 + $1 >>> 0));
  },
  384252: ($0, $1, $2, $3, $4, $5, $6) => ($6 ? Module.ghttpjs_urlstream : Module.ghttpjs_urlload)(Module.UTF8ToString($0), "GET", $1, null, $2, true, $3, $4, $5),
  384373: ($0, $1, $2, $3, $4, $5, $6, $7, $8) => ($8 ? Module.ghttpjs_urlstream : Module.ghttpjs_urlload)(Module.UTF8ToString($0), "POST", $1, HEAPU8.subarray($6 >>> 0, $6 + Number($7) >>> 0), $2, true, $3, $4, $5),
  384524: ($0, $1, $2, $3, $4, $5, $6) => ($6 ? Module.ghttpjs_urlstream : Module.ghttpjs_urlload)(Module.UTF8ToString($0), "DELETE", $1, null, $2, true, $3, $4, $5),
  384648: ($0, $1, $2, $3, $4, $5, $6, $7, $8) => ($8 ? Module.ghttpjs_urlstream : Module.ghttpjs_urlload)(Module.UTF8ToString($0), "PUT", $1, HEAPU8.subarray($6 >>> 0, $6 + Number($7) >>> 0), $2, true, $3, $4, $5),
  384798: ($0, $1, $2, $3, $4, $5, $6, $7) => {
    var cb = $7;
    Module.gui_displayDialog($0, UTF8ToString($1), UTF8ToString($2), null, UTF8ToString($3), $4 ? UTF8ToString($4) : null, $5 ? UTF8ToString($5) : null, $6, function(gid, bi, bt, t) {
      var btj = stringToNewUTF8(bt);
      dynCall("viip", cb, [ gid, bi, btj ]);
      _free(btj);
    });
  },
  385061: ($0, $1, $2, $3, $4, $5, $6, $7, $8) => {
    var cb = $7;
    Module.gui_displayDialog($0, UTF8ToString($1), UTF8ToString($2), UTF8ToString($8), UTF8ToString($3), $4 ? UTF8ToString($4) : null, $5 ? UTF8ToString($5) : null, $6, function(gid, bi, bt, t) {
      var btj = stringToNewUTF8(bt);
      var tj = stringToNewUTF8(t);
      dynCall("viipp", cb, [ gid, bi, btj, tj ]);
      _free(btj);
      _free(tj);
    });
  },
  385378: $0 => {
    Module.gui_hideDialog($0);
  },
  385409: () => {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    _WebAudio_ALSoft = new AudioContext;
    return _WebAudio_ALSoft.sampleRate;
  },
  385557: () => {
    if (_WebAudio_ALSoft) _WebAudio_ALSoft.resume();
  },
  385610: () => {
    if (_WebAudio_ALSoft) _WebAudio_ALSoft.suspend();
  },
  385664: () => _WebAudio_ALSoft.currentTime,
  385705: ($0, $1, $2, $3) => {
    var audioBuf = _WebAudio_ALSoft.createBuffer(2, Number($1), $2);
    var channel0 = audioBuf.getChannelData(0);
    var channel1 = audioBuf.getChannelData(1);
    var pData = $0;
    pData >>= 2;
    for (var i = 0; i < $1; ++i) {
      channel0[i] = HEAPF32[pData++ >>> 0];
      channel1[i] = HEAPF32[pData++ >>> 0];
    }
    var audioSrc = _WebAudio_ALSoft.createBufferSource();
    audioSrc.buffer = audioBuf;
    audioSrc.connect(_WebAudio_ALSoft.destination);
    audioSrc.start($3);
  },
  386134: () => {
    if (_WebAudio_ALSoft) _WebAudio_ALSoft.close();
    _WebAudio_ALSoft = undefined;
  },
  386214: $0 => Module.requestFile(UTF8ToString($0)),
  386263: () => FS.documentsOk,
  386288: $0 => {
    Module.luaError(UTF8ToString($0));
  },
  386326: $0 => {
    Module.luaError(UTF8ToString($0));
  },
  386364: () => {
    Module.setStatus("Running");
  },
  386392: $0 => {
    Module.luaPrint(UTF8ToString($0));
  },
  386430: $0 => {
    Module.luaPrint(UTF8ToString($0));
  },
  386468: ($0, $1, $2, $3, $4, $5, $6, $7, $8) => {
    Module.GiderosJSArgs = Array($1, $2, $3, $4, $5, $6, $7, $8);
    var r = stringToNewUTF8(String(eval(UTF8ToString($0))));
    Module.GiderosJSArgs = null;
    return r;
  },
  386625: () => window.innerWidth,
  386653: () => window.innerHeight,
  386682: () => {
    Module.checkALMuted();
  },
  386705: () => {
    Module.showGLContextLost(1);
  },
  386738: () => {
    Module.showGLContextLost(0);
  },
  386771: () => {
    Module.setStatus("Initializing");
  },
  386804: () => stringToNewUTF8(location.href),
  386847: () => {
    Module.registerPlugins();
  },
  386872: () => window.innerWidth,
  386902: () => window.innerHeight,
  386933: () => Module.hasGApp,
  386960: () => {
    if (!FS.gidSyncing) {
      FS.gidSyncing = true;
      FS.syncfs(function(err) {
        FS.gidSyncing = false;
      });
    }
  },
  387060: ($0, $1) => stringToNewUTF8(Module.JSCallJS(UTF8ToString($0), UTF8ToString($1)) || "null"),
  387148: ($0, $1) => {
    Module.showError(UTF8ToString($0), UTF8ToString($1));
  },
  387204: ($0, $1) => {
    Module.showError(UTF8ToString($0), UTF8ToString($1));
  },
  387260: () => stringToNewUTF8(navigator.userAgent),
  387309: ($0, $1) => {
    if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
      window.navigator.clipboard.writeText(UTF8ToString($1)).then(function() {
        Module._gapplication_clipboardCallback($0, 1, 0, 0);
      }).catch(function() {
        Module._gapplication_clipboardCallback($0, -1, 0, 0);
      });
    } else Module._gapplication_clipboardCallback($0, -1, "", "");
  },
  387649: $0 => {
    if (window.navigator.clipboard && window.navigator.clipboard.readText) {
      window.navigator.clipboard.readText().then(function(clipText) {
        var cClip = stringToNewUTF8(clipText);
        var cMime = stringToNewUTF8("text/plain");
        Module._gapplication_clipboardCallback($0, 1, cClip, cMime);
        _free(cClip);
        _free(cMime);
      }).catch(err => Module._gapplication_clipboardCallback($0, -1, 0, 0));
    } else Module._gapplication_clipboardCallback($0, -1, 0, 0);
  },
  388086: $0 => {
    window.navigator.vibrate($0);
  },
  388120: () => stringToNewUTF8(Intl.DateTimeFormat().resolvedOptions().timeZone),
  388198: () => stringToNewUTF8(Module.gplatformLanguage()),
  388254: $0 => {
    window.open(UTF8ToString($0));
  },
  388289: $0 => {
    document.getElementById("canvas").style.cursor = UTF8ToString($0);
  }
};

// Imports from the Wasm binary.
var _gapplication_addCallback, _gapplication_removeCallback, _main_registerPlugin, _JSPlayer_play, _JSPlayer_stop, _JSPlayer_writeFile, _JSCall, _JSCallV, _main, _JSNative_enqueueEvent, _g_pluginMain_JSNative, _g_pluginMain_WebXR, _cJSON_GetErrorPtr, _cJSON_GetStringValue, _cJSON_IsString, _cJSON_Version, _cJSON_InitHooks, _cJSON_Delete, _cJSON_SetNumberHelper, _cJSON_ParseWithOpts, _cJSON_Parse, _cJSON_Print, _cJSON_PrintUnformatted, _cJSON_PrintBuffered, _cJSON_PrintPreallocated, _cJSON_GetArraySize, _cJSON_GetArrayItem, _cJSON_GetObjectItem, _cJSON_GetObjectItemCaseSensitive, _cJSON_HasObjectItem, _cJSON_AddItemToArray, _cJSON_AddItemToObject, _cJSON_AddItemToObjectCS, _cJSON_AddItemReferenceToArray, _cJSON_AddItemReferenceToObject, _cJSON_AddNullToObject, _cJSON_CreateNull, _cJSON_AddTrueToObject, _cJSON_CreateTrue, _cJSON_AddFalseToObject, _cJSON_CreateFalse, _cJSON_AddBoolToObject, _cJSON_CreateBool, _cJSON_AddNumberToObject, _cJSON_CreateNumber, _cJSON_AddStringToObject, _cJSON_CreateString, _cJSON_AddBinaryToObject, _cJSON_CreateBinary, _cJSON_AddRawToObject, _cJSON_CreateRaw, _cJSON_AddObjectToObject, _cJSON_CreateObject, _cJSON_AddArrayToObject, _cJSON_CreateArray, _cJSON_DetachItemViaPointer, _cJSON_DetachItemFromArray, _cJSON_DeleteItemFromArray, _cJSON_DetachItemFromObject, _cJSON_DetachItemFromObjectCaseSensitive, _cJSON_DeleteItemFromObject, _cJSON_DeleteItemFromObjectCaseSensitive, _cJSON_InsertItemInArray, _cJSON_ReplaceItemViaPointer, _cJSON_ReplaceItemInArray, _cJSON_ReplaceItemInObject, _cJSON_ReplaceItemInObjectCaseSensitive, _cJSON_malloc, _cJSON_CreateStringReference, _cJSON_CreateObjectReference, _cJSON_CreateArrayReference, _cJSON_CreateIntArray, _cJSON_CreateFloatArray, _cJSON_CreateDoubleArray, _cJSON_CreateStringArray, _cJSON_Duplicate, _cJSON_Minify, _cJSON_IsInvalid, _cJSON_IsFalse, _cJSON_IsTrue, _cJSON_IsBool, _cJSON_IsNull, _cJSON_IsNumber, _cJSON_IsArray, _cJSON_IsObject, _cJSON_IsRaw, _cJSON_Compare, _cJSON_free, _gapplication_clipboardCallback, _gimage_parseImage, _gimage_saveImage, _gimage_loadImage, _gimage_premultiplyAlpha, _gimage_parsePng, _gimage_loadPng, _gimage_savePng, _gimage_parseJpg, _gimage_loadJpg, _gimage_saveJpg, _gtexture_set_engine, _gtexture_get_engine, _gtexture_set_spritefactory, _gtexture_get_spritefactory, _gtexture_set_screenmanager, _gtexture_get_screenmanager, _gtexture_init, _gtexture_cleanup, _gtexture_create, _gtexture_update, _gtexture_delete, _gtexture_getInternalTexture, _gtexture_setUserData, _gtexture_getUserData, _gtexture_tick, _gtexture_setCachingEnabled, _gtexture_reloadTextures, _gtexture_reuse, _gtexture_getMemoryUsage, _gtexture_RenderTargetCreate, _gtexture_RenderTargetGetFBO, _gtexture_SaveRenderTargets, _gtexture_RestoreRenderTargets, _gtexture_TempTextureCreate, _gtexture_TempTextureDelete, _gtexture_TempTextureGetName, _gtexture_RestoreTempTextures, _gtexture_BindRenderTarget, _g_setGlobalHook, _g_getGlobalHook, __ZN19gevent_CallbackList13dispatchEventEiPv, _gevent_Init, __ZN19gevent_CallbackListC1Ev, __ZN19gevent_CallbackListD1Ev, _gevent_Cleanup, _gevent_Tick, _gevent_SetFlusher, _gevent_AllowEventMerge, _gevent_Flush, _gevent_EnqueueEvent, _gevent_MergeEvent, _gevent_RemoveEventsWithGid, _gevent_AddCallback, _gevent_RemoveCallback, _gevent_RemoveCallbackWithGid, __ZN19gevent_CallbackListC2Ev, __ZN19gevent_CallbackListD2Ev, __ZN19gevent_CallbackList11addCallbackEPFviPvS0_ES0_, __ZN19gevent_CallbackList14removeCallbackEPFviPvS0_ES0_, __ZN19gevent_CallbackList21removeCallbackWithGidEm, _gevent_CreateEventStruct1, _gevent_CreateEventStruct2, _gevent_CreateEventStruct3, __Z31gevent_EnqueuePermissionsResultRNSt3__23mapINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEiNS_4lessIS6_EENS4_INS_4pairIKS6_iEEEEEE, _glog, _glog_v, _glog_d, _glog_i, _glog_w, _glog_e, _glog_setLevel, _glog_getLevel, _g_NextId, _g_iclock, _gaudio_Init, _gaudio_Cleanup, _gaudio_SoundCreateFromFile, _gaudio_SoundCreateFromData, _gaudio_SoundReadFile, _gaudio_SoundDelete, _gaudio_SoundGetLength, _gaudio_SoundPlay, _gaudio_SoundListener, _gaudio_SoundHasEffect, _gaudio_ChannelStop, _gaudio_ChannelSetPosition, _gaudio_ChannelGetPosition, _gaudio_ChannelSetPaused, _gaudio_ChannelIsPaused, _gaudio_ChannelIsPlaying, _gaudio_ChannelSetVolume, _gaudio_ChannelGetVolume, _gaudio_ChannelGetStreamId, _gaudio_ChannelSetPitch, _gaudio_ChannelGetPitch, _gaudio_ChannelSetLooping, _gaudio_ChannelIsLooping, _gaudio_ChannelSetWorldPosition, _gaudio_ChannelSetEffect, _gaudio_ChannelAddCallback, _gaudio_ChannelRemoveCallback, _gaudio_ChannelRemoveCallbackWithGid, _gaudio_BackgroundMusicIsAvailable, _gaudio_BackgroundMusicCreateFromFile, _gaudio_BackgroundMusicDelete, _gaudio_BackgroundMusicGetLength, _gaudio_BackgroundMusicPlay, _gaudio_BackgroundChannelStop, _gaudio_BackgroundChannelSetPosition, _gaudio_BackgroundChannelGetPosition, _gaudio_BackgroundChannelSetPaused, _gaudio_BackgroundChannelIsPaused, _gaudio_BackgroundChannelIsPlaying, _gaudio_BackgroundChannelSetVolume, _gaudio_BackgroundChannelGetVolume, _gaudio_BackgroundChannelSetLooping, _gaudio_BackgroundChannelIsLooping, _gaudio_BackgroundChannelAddCallback, _gaudio_BackgroundChannelRemoveCallback, _gaudio_BackgroundChannelRemoveCallbackWithGid, _gaudio_AdvanceStreamBuffers, _gaudio_registerType, _gaudio_unregisterType, _gaudio_registerEncoderType, _gaudio_unregisterEncoderType, _gaudio_lookupEncoder, _gaudio_WavOpen, _gaudio_WavClose, _gaudio_WavSeek, _gaudio_WavTell, _gaudio_WavRead, _gvfs_init, _gvfs_setCodeKey, _gvfs_setAssetsKey, _gvfs_cleanup, _gvfs_setZipFile, _gvfs_addFile, __ZN11GReferenced3refEv, __ZN11GReferenced5unrefEv, __ZNK11GReferenced5proxyEv, __ZN11GReferencedC2Ev, __ZN11GReferencedD2Ev, __ZN8StringId8instanceEv, __ZN8StringId2idEPKc, _lua_toboolean2, _luaL_newweaktable, _luaL_nullifytable, _luaC_traceback, _lua_pcall_traceback, _lua_traceback, _luaL_rawgetptr, _luaL_rawsetptr, _luaL_setdata, _luaL_getdata, _g_registerPlugin, _g_registerOpenUrlCallback, _g_registerEnterFrameCallback, _g_registerSuspendCallback, _g_registerResumeCallback, _g_registerForegroundCallback, _g_registerBackgroundCallback, _g_registerInterruptCallback, _g_initializeBinderState, _g_disableTypeChecking, _g_enableTypeChecking, _g_isTypeCheckingEnabled, _g_createClass, _g_makeInstance, _g_pushInstance, _g_isInstanceOf, _g_getInstance, _g_getInstanceOfType, _g_setInstance, _g_error, __ZN6GProxyC2ENS_5GTypeE, __ZN6GProxyD2Ev, __ZN21GEventDispatcherProxyC2EN6GProxy5GTypeE, __ZN21GEventDispatcherProxyD0Ev, __ZN21GEventDispatcherProxyD1Ev, __ZN21GEventDispatcherProxyC1EN6GProxy5GTypeE, __ZN21GEventDispatcherProxyD2Ev, _g_clearerr, _g_fclose, _g_feof, _g_ferror, _g_fflush, _g_fgetc, _g_fgets, _g_setVfs, _g_flockfile, _g_ftrylockfile, _g_funlockfile, _g_fopen, _g_fprintf, _g_fread, _g_fscanf, _g_fseek, _g_ftell, _g_fwrite, _g_getc, _g_setvbuf, _g_tmpfile, _g_ungetc, _g_vfprintf, _g_vfscanf, _g_pathForFile, __Z21getDocumentsDirectoryv, __Z21getTemporaryDirectoryv, __Z20getResourceDirectoryv, __Z21setDocumentsDirectoryPKc, __Z21setTemporaryDirectoryPKc, __Z20setResourceDirectoryPKc, __Z13pathForFileExPKcS0_, __Z11getFileTypePKc, _gpath_init, _gpath_cleanup, _gpath_setDrivePath, _gpath_setDriveFlags, _gpath_addDrivePrefix, _gpath_setDriveVfs, _gpath_setDefaultDrive, _gpath_getDefaultDrive, _gpath_getDrivePath, _gpath_getDriveFlags, _gpath_getDriveVfs, _gpath_setAbsolutePathFlags, _gpath_getPathDrive, _gpath_join, _gpath_transform, _gpath_normalizeArchivePath, _lua_checkstack, _lua_gettop, _lua_settop, _lua_remove, _lua_insert, _lua_replace, _lua_pushvalue, _lua_type, _lua_typename, _lua_isnumber, _lua_isstring, _lua_tonumberx, _lua_tointegerx, _lua_tounsignedx, _lua_toboolean, _lua_tolstring, _lua_objlen, _lua_touserdata, _lua_topointer, _lua_pushnil, _lua_pushnumber, _lua_pushinteger, _lua_pushvector, _lua_pushcolorf, _lua_pushlstring, _lua_pushstring, _lua_pushfstringL, _lua_pushcclosurek, _lua_pushboolean, _lua_pushlightuserdatatagged, _lua_gettable, _lua_getfield, _lua_rawgetfield, _lua_rawget, _lua_rawgeti, _lua_createtable, _lua_getmetatable, _lua_settable, _lua_setfield, _lua_rawset, _lua_rawseti, _lua_setmetatable, _lua_call, _lua_pcall, _lua_error, _lua_next, _lua_newuserdatatagged, _lua_newuserdatadtor, _lua_ref, _lua_unref, _luaL_argerrorL, _luaL_errorL, _luaL_typeerrorL, _luaL_checkoption, _luaL_optlstring, _luaL_checklstring, _luaL_newmetatable, _luaL_checkudata, _luaL_checkstack, _luaL_checktype, _luaL_checknumber, _luaL_optnumber, _luaL_optboolean, _luaL_checkinteger, _luaL_optinteger, _luaL_register, _luaL_typename, _luaL_pushresult, _luaL_buffinit, _luaL_addlstring, _luaL_prepbuffsize, _luaL_ref, _lua_isclosing, ___cxa_atexit, ___errno_location, _abort, _access, _acos, _acosf, _atan, _atan2, _atan2f, _atof, _bsearch, _chdir, _close, _closedir, _cos, _cosf, ___dl_seterr, __emscripten_find_dylib, _time, _gettimeofday, _exp, _exp2, _fchmod, _fchown, _fclose, _fcntl, _fileno, _fmax, _fmin, _fmodf, _fopen, _fiprintf, ___small_fprintf, _fputc, _fstat, _fsync, _ftruncate, _fwrite, _gai_strerror, _getcwd, _getenv, _geteuid, _gethostname, _getpid, ___h_errno_location, _hstrerror, _htonl, _htons, _inet_ntoa, _isalnum, _isblank, _isspace, _ldexp, _pthread_mutex_init, _pthread_mutex_destroy, _pthread_mutexattr_init, _pthread_mutexattr_settype, _pthread_mutexattr_destroy, _pthread_mutex_lock, _pthread_mutex_unlock, _pthread_mutex_trylock, _link, _localtime, _log, _log10, _logf, _lrintf, _lseek, _lstat, _memchr, _memcmp, _mkdir, ___mmap, ___munmap, _nanosleep, _ntohs, _open, _opendir, _poll, _pow, _powf, _iprintf, _qsort, _srand, _rand, _read, _readdir, _readlink, _rmdir, _round, _select, _setlocale, _signal, _sin, _sinf, _sleep, _snprintf, _siprintf, ___small_sprintf, _sscanf, _stat, _strcasecmp, _strcat, _strchr, _strcmp, _strcpy, _strerror, _strftime, _strlen, _strncasecmp, _strncat, _strncmp, _strncpy, _strrchr, _strstr, _strtod, _strtoul, _strtol, _symlink, _tan, _toupper, _unlink, _utime, _utimes, _vfprintf, _vsnprintf, _wcslen, _write, _malloc, _free, _calloc, _realloc, _posix_memalign, _emscripten_builtin_memalign, ___trap, ___addtf3, ___getf2, ___lttf2, ___gttf2, ___divtf3, __emscripten_tempret_set, __emscripten_tempret_get, ___extenddftf2, ___fixtfsi, ___floatditf, ___floatsitf, ___multf3, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current, ___subtf3, ___trunctfdf2, __ZNSt3__26chrono12system_clock3nowEv, __ZNSt13exception_ptrD1Ev, __ZNSt13exception_ptrC1ERKS_, __ZSt17rethrow_exceptionSt13exception_ptr, __ZNSt3__217__assoc_sub_state10__sub_waitERNS_11unique_lockINS_5mutexEEE, __ZNSt3__212__next_primeEm, __ZNSt3__29basic_iosIcNS_11char_traitsIcEEED2Ev, __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE5flushEv, __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryC1ERS3_, __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryD1Ev, __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEb, __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEt, __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEj, __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEf, __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE3putEc, __ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED2Ev, __ZNKSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE3strEv, __ZNKSt3__28ios_base6getlocEv, __ZNSt3__28ios_base5clearEj, __ZNSt3__28ios_base4initEPv, __ZNSt3__26localeD1Ev, __ZNKSt3__26locale9use_facetERNS0_2idE, __ZNSt3__26localeC1ERKS0_, __ZNKSt3__26locale4nameEv, __ZNSt3__26localeC1Ev, __ZNSt3__219__shared_weak_count14__release_weakEv, __ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info, __ZNSt3__219__shared_weak_countD2Ev, __ZNSt3__25mutex4lockEv, __ZNSt3__25mutex6unlockEv, __ZNSt3__25mutexD1Ev, __Znwm, __ZnwmRKSt9nothrow_t, __Znam, __ZdlPv, __ZdlPvm, __ZdaPv, __ZNSt3__211regex_errorD1Ev, __ZNSt3__220__get_collation_nameEPKc, __ZNSt3__215__get_classnameEPKcb, __ZNKSt3__223__match_any_but_newlineIcE6__execERNS_7__stateIcEE, __ZNSt3__211regex_errorC1ENS_15regex_constants10error_typeE, __ZNSt11logic_errorC2EPKc, __ZNSt13runtime_errorC1EPKc, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEaSEc, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE25__init_copy_ctor_externalEPKcm, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_externalEPKcm, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_externalEPKc, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEPKcm, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6insertEmPKc, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_no_aliasILb0EEERS5_PKcm, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_no_aliasILb1EEERS5_PKcm, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEPKc, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6resizeEmc, __ZNSt3__2plIcNS_11char_traitsIcEENS_9allocatorIcEEEENS_12basic_stringIT_T0_T1_EEPKS6_RKS9_, __ZNSt3__29to_stringEi, __ZNSt3__29to_stringEj, __ZNSt3__29to_stringEf, ___cxa_allocate_exception, ___cxa_throw, ___cxa_pure_virtual, __ZNSt9exceptionD2Ev, __ZNSt20bad_array_new_lengthD1Ev, __ZNSt20bad_array_new_lengthC1Ev, __ZNSt13runtime_errorD1Ev, __ZNSt12length_errorD1Ev, __Unwind_CallPersonality, _accept, _bind, _connect, _freeaddrinfo, _gethostbyaddr, _gethostbyname, _getpeername, _getsockname, _getsockopt, _listen, _recv, _recvfrom, _send, _sendto, _setsockopt, _shutdown, _socket, ___wasm_apply_data_relocs;

function assignWasmExports(wasmExports) {
  Module["_gapplication_addCallback"] = _gapplication_addCallback = wasmExports["gapplication_addCallback"];
  Module["_gapplication_removeCallback"] = _gapplication_removeCallback = wasmExports["gapplication_removeCallback"];
  Module["_main_registerPlugin"] = _main_registerPlugin = wasmExports["main_registerPlugin"];
  Module["_JSPlayer_play"] = _JSPlayer_play = wasmExports["JSPlayer_play"];
  Module["_JSPlayer_stop"] = _JSPlayer_stop = wasmExports["JSPlayer_stop"];
  Module["_JSPlayer_writeFile"] = _JSPlayer_writeFile = wasmExports["JSPlayer_writeFile"];
  Module["_JSCall"] = _JSCall = wasmExports["JSCall"];
  Module["_JSCallV"] = _JSCallV = wasmExports["JSCallV"];
  Module["_main"] = _main = wasmExports["main"];
  Module["_JSNative_enqueueEvent"] = _JSNative_enqueueEvent = wasmExports["JSNative_enqueueEvent"];
  Module["_g_pluginMain_JSNative"] = _g_pluginMain_JSNative = wasmExports["g_pluginMain_JSNative"];
  Module["_g_pluginMain_WebXR"] = _g_pluginMain_WebXR = wasmExports["g_pluginMain_WebXR"];
  Module["_cJSON_GetErrorPtr"] = _cJSON_GetErrorPtr = wasmExports["cJSON_GetErrorPtr"];
  Module["_cJSON_GetStringValue"] = _cJSON_GetStringValue = wasmExports["cJSON_GetStringValue"];
  Module["_cJSON_IsString"] = _cJSON_IsString = wasmExports["cJSON_IsString"];
  Module["_cJSON_Version"] = _cJSON_Version = wasmExports["cJSON_Version"];
  Module["_cJSON_InitHooks"] = _cJSON_InitHooks = wasmExports["cJSON_InitHooks"];
  Module["_cJSON_Delete"] = _cJSON_Delete = wasmExports["cJSON_Delete"];
  Module["_cJSON_SetNumberHelper"] = _cJSON_SetNumberHelper = wasmExports["cJSON_SetNumberHelper"];
  Module["_cJSON_ParseWithOpts"] = _cJSON_ParseWithOpts = wasmExports["cJSON_ParseWithOpts"];
  Module["_cJSON_Parse"] = _cJSON_Parse = wasmExports["cJSON_Parse"];
  Module["_cJSON_Print"] = _cJSON_Print = wasmExports["cJSON_Print"];
  Module["_cJSON_PrintUnformatted"] = _cJSON_PrintUnformatted = wasmExports["cJSON_PrintUnformatted"];
  Module["_cJSON_PrintBuffered"] = _cJSON_PrintBuffered = wasmExports["cJSON_PrintBuffered"];
  Module["_cJSON_PrintPreallocated"] = _cJSON_PrintPreallocated = wasmExports["cJSON_PrintPreallocated"];
  Module["_cJSON_GetArraySize"] = _cJSON_GetArraySize = wasmExports["cJSON_GetArraySize"];
  Module["_cJSON_GetArrayItem"] = _cJSON_GetArrayItem = wasmExports["cJSON_GetArrayItem"];
  Module["_cJSON_GetObjectItem"] = _cJSON_GetObjectItem = wasmExports["cJSON_GetObjectItem"];
  Module["_cJSON_GetObjectItemCaseSensitive"] = _cJSON_GetObjectItemCaseSensitive = wasmExports["cJSON_GetObjectItemCaseSensitive"];
  Module["_cJSON_HasObjectItem"] = _cJSON_HasObjectItem = wasmExports["cJSON_HasObjectItem"];
  Module["_cJSON_AddItemToArray"] = _cJSON_AddItemToArray = wasmExports["cJSON_AddItemToArray"];
  Module["_cJSON_AddItemToObject"] = _cJSON_AddItemToObject = wasmExports["cJSON_AddItemToObject"];
  Module["_cJSON_AddItemToObjectCS"] = _cJSON_AddItemToObjectCS = wasmExports["cJSON_AddItemToObjectCS"];
  Module["_cJSON_AddItemReferenceToArray"] = _cJSON_AddItemReferenceToArray = wasmExports["cJSON_AddItemReferenceToArray"];
  Module["_cJSON_AddItemReferenceToObject"] = _cJSON_AddItemReferenceToObject = wasmExports["cJSON_AddItemReferenceToObject"];
  Module["_cJSON_AddNullToObject"] = _cJSON_AddNullToObject = wasmExports["cJSON_AddNullToObject"];
  Module["_cJSON_CreateNull"] = _cJSON_CreateNull = wasmExports["cJSON_CreateNull"];
  Module["_cJSON_AddTrueToObject"] = _cJSON_AddTrueToObject = wasmExports["cJSON_AddTrueToObject"];
  Module["_cJSON_CreateTrue"] = _cJSON_CreateTrue = wasmExports["cJSON_CreateTrue"];
  Module["_cJSON_AddFalseToObject"] = _cJSON_AddFalseToObject = wasmExports["cJSON_AddFalseToObject"];
  Module["_cJSON_CreateFalse"] = _cJSON_CreateFalse = wasmExports["cJSON_CreateFalse"];
  Module["_cJSON_AddBoolToObject"] = _cJSON_AddBoolToObject = wasmExports["cJSON_AddBoolToObject"];
  Module["_cJSON_CreateBool"] = _cJSON_CreateBool = wasmExports["cJSON_CreateBool"];
  Module["_cJSON_AddNumberToObject"] = _cJSON_AddNumberToObject = wasmExports["cJSON_AddNumberToObject"];
  Module["_cJSON_CreateNumber"] = _cJSON_CreateNumber = wasmExports["cJSON_CreateNumber"];
  Module["_cJSON_AddStringToObject"] = _cJSON_AddStringToObject = wasmExports["cJSON_AddStringToObject"];
  Module["_cJSON_CreateString"] = _cJSON_CreateString = wasmExports["cJSON_CreateString"];
  Module["_cJSON_AddBinaryToObject"] = _cJSON_AddBinaryToObject = wasmExports["cJSON_AddBinaryToObject"];
  Module["_cJSON_CreateBinary"] = _cJSON_CreateBinary = wasmExports["cJSON_CreateBinary"];
  Module["_cJSON_AddRawToObject"] = _cJSON_AddRawToObject = wasmExports["cJSON_AddRawToObject"];
  Module["_cJSON_CreateRaw"] = _cJSON_CreateRaw = wasmExports["cJSON_CreateRaw"];
  Module["_cJSON_AddObjectToObject"] = _cJSON_AddObjectToObject = wasmExports["cJSON_AddObjectToObject"];
  Module["_cJSON_CreateObject"] = _cJSON_CreateObject = wasmExports["cJSON_CreateObject"];
  Module["_cJSON_AddArrayToObject"] = _cJSON_AddArrayToObject = wasmExports["cJSON_AddArrayToObject"];
  Module["_cJSON_CreateArray"] = _cJSON_CreateArray = wasmExports["cJSON_CreateArray"];
  Module["_cJSON_DetachItemViaPointer"] = _cJSON_DetachItemViaPointer = wasmExports["cJSON_DetachItemViaPointer"];
  Module["_cJSON_DetachItemFromArray"] = _cJSON_DetachItemFromArray = wasmExports["cJSON_DetachItemFromArray"];
  Module["_cJSON_DeleteItemFromArray"] = _cJSON_DeleteItemFromArray = wasmExports["cJSON_DeleteItemFromArray"];
  Module["_cJSON_DetachItemFromObject"] = _cJSON_DetachItemFromObject = wasmExports["cJSON_DetachItemFromObject"];
  Module["_cJSON_DetachItemFromObjectCaseSensitive"] = _cJSON_DetachItemFromObjectCaseSensitive = wasmExports["cJSON_DetachItemFromObjectCaseSensitive"];
  Module["_cJSON_DeleteItemFromObject"] = _cJSON_DeleteItemFromObject = wasmExports["cJSON_DeleteItemFromObject"];
  Module["_cJSON_DeleteItemFromObjectCaseSensitive"] = _cJSON_DeleteItemFromObjectCaseSensitive = wasmExports["cJSON_DeleteItemFromObjectCaseSensitive"];
  Module["_cJSON_InsertItemInArray"] = _cJSON_InsertItemInArray = wasmExports["cJSON_InsertItemInArray"];
  Module["_cJSON_ReplaceItemViaPointer"] = _cJSON_ReplaceItemViaPointer = wasmExports["cJSON_ReplaceItemViaPointer"];
  Module["_cJSON_ReplaceItemInArray"] = _cJSON_ReplaceItemInArray = wasmExports["cJSON_ReplaceItemInArray"];
  Module["_cJSON_ReplaceItemInObject"] = _cJSON_ReplaceItemInObject = wasmExports["cJSON_ReplaceItemInObject"];
  Module["_cJSON_ReplaceItemInObjectCaseSensitive"] = _cJSON_ReplaceItemInObjectCaseSensitive = wasmExports["cJSON_ReplaceItemInObjectCaseSensitive"];
  Module["_cJSON_malloc"] = _cJSON_malloc = wasmExports["cJSON_malloc"];
  Module["_cJSON_CreateStringReference"] = _cJSON_CreateStringReference = wasmExports["cJSON_CreateStringReference"];
  Module["_cJSON_CreateObjectReference"] = _cJSON_CreateObjectReference = wasmExports["cJSON_CreateObjectReference"];
  Module["_cJSON_CreateArrayReference"] = _cJSON_CreateArrayReference = wasmExports["cJSON_CreateArrayReference"];
  Module["_cJSON_CreateIntArray"] = _cJSON_CreateIntArray = wasmExports["cJSON_CreateIntArray"];
  Module["_cJSON_CreateFloatArray"] = _cJSON_CreateFloatArray = wasmExports["cJSON_CreateFloatArray"];
  Module["_cJSON_CreateDoubleArray"] = _cJSON_CreateDoubleArray = wasmExports["cJSON_CreateDoubleArray"];
  Module["_cJSON_CreateStringArray"] = _cJSON_CreateStringArray = wasmExports["cJSON_CreateStringArray"];
  Module["_cJSON_Duplicate"] = _cJSON_Duplicate = wasmExports["cJSON_Duplicate"];
  Module["_cJSON_Minify"] = _cJSON_Minify = wasmExports["cJSON_Minify"];
  Module["_cJSON_IsInvalid"] = _cJSON_IsInvalid = wasmExports["cJSON_IsInvalid"];
  Module["_cJSON_IsFalse"] = _cJSON_IsFalse = wasmExports["cJSON_IsFalse"];
  Module["_cJSON_IsTrue"] = _cJSON_IsTrue = wasmExports["cJSON_IsTrue"];
  Module["_cJSON_IsBool"] = _cJSON_IsBool = wasmExports["cJSON_IsBool"];
  Module["_cJSON_IsNull"] = _cJSON_IsNull = wasmExports["cJSON_IsNull"];
  Module["_cJSON_IsNumber"] = _cJSON_IsNumber = wasmExports["cJSON_IsNumber"];
  Module["_cJSON_IsArray"] = _cJSON_IsArray = wasmExports["cJSON_IsArray"];
  Module["_cJSON_IsObject"] = _cJSON_IsObject = wasmExports["cJSON_IsObject"];
  Module["_cJSON_IsRaw"] = _cJSON_IsRaw = wasmExports["cJSON_IsRaw"];
  Module["_cJSON_Compare"] = _cJSON_Compare = wasmExports["cJSON_Compare"];
  Module["_cJSON_free"] = _cJSON_free = wasmExports["cJSON_free"];
  Module["_gapplication_clipboardCallback"] = _gapplication_clipboardCallback = wasmExports["gapplication_clipboardCallback"];
  Module["_gimage_parseImage"] = _gimage_parseImage = wasmExports["gimage_parseImage"];
  Module["_gimage_saveImage"] = _gimage_saveImage = wasmExports["gimage_saveImage"];
  Module["_gimage_loadImage"] = _gimage_loadImage = wasmExports["gimage_loadImage"];
  Module["_gimage_premultiplyAlpha"] = _gimage_premultiplyAlpha = wasmExports["gimage_premultiplyAlpha"];
  Module["_gimage_parsePng"] = _gimage_parsePng = wasmExports["gimage_parsePng"];
  Module["_gimage_loadPng"] = _gimage_loadPng = wasmExports["gimage_loadPng"];
  Module["_gimage_savePng"] = _gimage_savePng = wasmExports["gimage_savePng"];
  Module["_gimage_parseJpg"] = _gimage_parseJpg = wasmExports["gimage_parseJpg"];
  Module["_gimage_loadJpg"] = _gimage_loadJpg = wasmExports["gimage_loadJpg"];
  Module["_gimage_saveJpg"] = _gimage_saveJpg = wasmExports["gimage_saveJpg"];
  Module["_gtexture_set_engine"] = _gtexture_set_engine = wasmExports["gtexture_set_engine"];
  Module["_gtexture_get_engine"] = _gtexture_get_engine = wasmExports["gtexture_get_engine"];
  Module["_gtexture_set_spritefactory"] = _gtexture_set_spritefactory = wasmExports["gtexture_set_spritefactory"];
  Module["_gtexture_get_spritefactory"] = _gtexture_get_spritefactory = wasmExports["gtexture_get_spritefactory"];
  Module["_gtexture_set_screenmanager"] = _gtexture_set_screenmanager = wasmExports["gtexture_set_screenmanager"];
  Module["_gtexture_get_screenmanager"] = _gtexture_get_screenmanager = wasmExports["gtexture_get_screenmanager"];
  Module["_gtexture_init"] = _gtexture_init = wasmExports["gtexture_init"];
  Module["_gtexture_cleanup"] = _gtexture_cleanup = wasmExports["gtexture_cleanup"];
  Module["_gtexture_create"] = _gtexture_create = wasmExports["gtexture_create"];
  Module["_gtexture_update"] = _gtexture_update = wasmExports["gtexture_update"];
  Module["_gtexture_delete"] = _gtexture_delete = wasmExports["gtexture_delete"];
  Module["_gtexture_getInternalTexture"] = _gtexture_getInternalTexture = wasmExports["gtexture_getInternalTexture"];
  Module["_gtexture_setUserData"] = _gtexture_setUserData = wasmExports["gtexture_setUserData"];
  Module["_gtexture_getUserData"] = _gtexture_getUserData = wasmExports["gtexture_getUserData"];
  Module["_gtexture_tick"] = _gtexture_tick = wasmExports["gtexture_tick"];
  Module["_gtexture_setCachingEnabled"] = _gtexture_setCachingEnabled = wasmExports["gtexture_setCachingEnabled"];
  Module["_gtexture_reloadTextures"] = _gtexture_reloadTextures = wasmExports["gtexture_reloadTextures"];
  Module["_gtexture_reuse"] = _gtexture_reuse = wasmExports["gtexture_reuse"];
  Module["_gtexture_getMemoryUsage"] = _gtexture_getMemoryUsage = wasmExports["gtexture_getMemoryUsage"];
  Module["_gtexture_RenderTargetCreate"] = _gtexture_RenderTargetCreate = wasmExports["gtexture_RenderTargetCreate"];
  Module["_gtexture_RenderTargetGetFBO"] = _gtexture_RenderTargetGetFBO = wasmExports["gtexture_RenderTargetGetFBO"];
  Module["_gtexture_SaveRenderTargets"] = _gtexture_SaveRenderTargets = wasmExports["gtexture_SaveRenderTargets"];
  Module["_gtexture_RestoreRenderTargets"] = _gtexture_RestoreRenderTargets = wasmExports["gtexture_RestoreRenderTargets"];
  Module["_gtexture_TempTextureCreate"] = _gtexture_TempTextureCreate = wasmExports["gtexture_TempTextureCreate"];
  Module["_gtexture_TempTextureDelete"] = _gtexture_TempTextureDelete = wasmExports["gtexture_TempTextureDelete"];
  Module["_gtexture_TempTextureGetName"] = _gtexture_TempTextureGetName = wasmExports["gtexture_TempTextureGetName"];
  Module["_gtexture_RestoreTempTextures"] = _gtexture_RestoreTempTextures = wasmExports["gtexture_RestoreTempTextures"];
  Module["_gtexture_BindRenderTarget"] = _gtexture_BindRenderTarget = wasmExports["gtexture_BindRenderTarget"];
  Module["_g_setGlobalHook"] = _g_setGlobalHook = wasmExports["g_setGlobalHook"];
  Module["_g_getGlobalHook"] = _g_getGlobalHook = wasmExports["g_getGlobalHook"];
  Module["__ZN19gevent_CallbackList13dispatchEventEiPv"] = __ZN19gevent_CallbackList13dispatchEventEiPv = wasmExports["_ZN19gevent_CallbackList13dispatchEventEiPv"];
  Module["_gevent_Init"] = _gevent_Init = wasmExports["gevent_Init"];
  Module["__ZN19gevent_CallbackListC1Ev"] = __ZN19gevent_CallbackListC1Ev = wasmExports["_ZN19gevent_CallbackListC1Ev"];
  Module["__ZN19gevent_CallbackListD1Ev"] = __ZN19gevent_CallbackListD1Ev = wasmExports["_ZN19gevent_CallbackListD1Ev"];
  Module["_gevent_Cleanup"] = _gevent_Cleanup = wasmExports["gevent_Cleanup"];
  Module["_gevent_Tick"] = _gevent_Tick = wasmExports["gevent_Tick"];
  Module["_gevent_SetFlusher"] = _gevent_SetFlusher = wasmExports["gevent_SetFlusher"];
  Module["_gevent_AllowEventMerge"] = _gevent_AllowEventMerge = wasmExports["gevent_AllowEventMerge"];
  Module["_gevent_Flush"] = _gevent_Flush = wasmExports["gevent_Flush"];
  Module["_gevent_EnqueueEvent"] = _gevent_EnqueueEvent = wasmExports["gevent_EnqueueEvent"];
  Module["_gevent_MergeEvent"] = _gevent_MergeEvent = wasmExports["gevent_MergeEvent"];
  Module["_gevent_RemoveEventsWithGid"] = _gevent_RemoveEventsWithGid = wasmExports["gevent_RemoveEventsWithGid"];
  Module["_gevent_AddCallback"] = _gevent_AddCallback = wasmExports["gevent_AddCallback"];
  Module["_gevent_RemoveCallback"] = _gevent_RemoveCallback = wasmExports["gevent_RemoveCallback"];
  Module["_gevent_RemoveCallbackWithGid"] = _gevent_RemoveCallbackWithGid = wasmExports["gevent_RemoveCallbackWithGid"];
  Module["__ZN19gevent_CallbackListC2Ev"] = __ZN19gevent_CallbackListC2Ev = wasmExports["_ZN19gevent_CallbackListC2Ev"];
  Module["__ZN19gevent_CallbackListD2Ev"] = __ZN19gevent_CallbackListD2Ev = wasmExports["_ZN19gevent_CallbackListD2Ev"];
  Module["__ZN19gevent_CallbackList11addCallbackEPFviPvS0_ES0_"] = __ZN19gevent_CallbackList11addCallbackEPFviPvS0_ES0_ = wasmExports["_ZN19gevent_CallbackList11addCallbackEPFviPvS0_ES0_"];
  Module["__ZN19gevent_CallbackList14removeCallbackEPFviPvS0_ES0_"] = __ZN19gevent_CallbackList14removeCallbackEPFviPvS0_ES0_ = wasmExports["_ZN19gevent_CallbackList14removeCallbackEPFviPvS0_ES0_"];
  Module["__ZN19gevent_CallbackList21removeCallbackWithGidEm"] = __ZN19gevent_CallbackList21removeCallbackWithGidEm = wasmExports["_ZN19gevent_CallbackList21removeCallbackWithGidEm"];
  Module["_gevent_CreateEventStruct1"] = _gevent_CreateEventStruct1 = wasmExports["gevent_CreateEventStruct1"];
  Module["_gevent_CreateEventStruct2"] = _gevent_CreateEventStruct2 = wasmExports["gevent_CreateEventStruct2"];
  Module["_gevent_CreateEventStruct3"] = _gevent_CreateEventStruct3 = wasmExports["gevent_CreateEventStruct3"];
  Module["__Z31gevent_EnqueuePermissionsResultRNSt3__23mapINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEiNS_4lessIS6_EENS4_INS_4pairIKS6_iEEEEEE"] = __Z31gevent_EnqueuePermissionsResultRNSt3__23mapINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEiNS_4lessIS6_EENS4_INS_4pairIKS6_iEEEEEE = wasmExports["_Z31gevent_EnqueuePermissionsResultRNSt3__23mapINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEiNS_4lessIS6_EENS4_INS_4pairIKS6_iEEEEEE"];
  Module["_glog"] = _glog = wasmExports["glog"];
  Module["_glog_v"] = _glog_v = wasmExports["glog_v"];
  Module["_glog_d"] = _glog_d = wasmExports["glog_d"];
  Module["_glog_i"] = _glog_i = wasmExports["glog_i"];
  Module["_glog_w"] = _glog_w = wasmExports["glog_w"];
  Module["_glog_e"] = _glog_e = wasmExports["glog_e"];
  Module["_glog_setLevel"] = _glog_setLevel = wasmExports["glog_setLevel"];
  Module["_glog_getLevel"] = _glog_getLevel = wasmExports["glog_getLevel"];
  Module["_g_NextId"] = _g_NextId = wasmExports["g_NextId"];
  Module["_g_iclock"] = _g_iclock = wasmExports["g_iclock"];
  Module["_gaudio_Init"] = _gaudio_Init = wasmExports["gaudio_Init"];
  Module["_gaudio_Cleanup"] = _gaudio_Cleanup = wasmExports["gaudio_Cleanup"];
  Module["_gaudio_SoundCreateFromFile"] = _gaudio_SoundCreateFromFile = wasmExports["gaudio_SoundCreateFromFile"];
  Module["_gaudio_SoundCreateFromData"] = _gaudio_SoundCreateFromData = wasmExports["gaudio_SoundCreateFromData"];
  Module["_gaudio_SoundReadFile"] = _gaudio_SoundReadFile = wasmExports["gaudio_SoundReadFile"];
  Module["_gaudio_SoundDelete"] = _gaudio_SoundDelete = wasmExports["gaudio_SoundDelete"];
  Module["_gaudio_SoundGetLength"] = _gaudio_SoundGetLength = wasmExports["gaudio_SoundGetLength"];
  Module["_gaudio_SoundPlay"] = _gaudio_SoundPlay = wasmExports["gaudio_SoundPlay"];
  Module["_gaudio_SoundListener"] = _gaudio_SoundListener = wasmExports["gaudio_SoundListener"];
  Module["_gaudio_SoundHasEffect"] = _gaudio_SoundHasEffect = wasmExports["gaudio_SoundHasEffect"];
  Module["_gaudio_ChannelStop"] = _gaudio_ChannelStop = wasmExports["gaudio_ChannelStop"];
  Module["_gaudio_ChannelSetPosition"] = _gaudio_ChannelSetPosition = wasmExports["gaudio_ChannelSetPosition"];
  Module["_gaudio_ChannelGetPosition"] = _gaudio_ChannelGetPosition = wasmExports["gaudio_ChannelGetPosition"];
  Module["_gaudio_ChannelSetPaused"] = _gaudio_ChannelSetPaused = wasmExports["gaudio_ChannelSetPaused"];
  Module["_gaudio_ChannelIsPaused"] = _gaudio_ChannelIsPaused = wasmExports["gaudio_ChannelIsPaused"];
  Module["_gaudio_ChannelIsPlaying"] = _gaudio_ChannelIsPlaying = wasmExports["gaudio_ChannelIsPlaying"];
  Module["_gaudio_ChannelSetVolume"] = _gaudio_ChannelSetVolume = wasmExports["gaudio_ChannelSetVolume"];
  Module["_gaudio_ChannelGetVolume"] = _gaudio_ChannelGetVolume = wasmExports["gaudio_ChannelGetVolume"];
  Module["_gaudio_ChannelGetStreamId"] = _gaudio_ChannelGetStreamId = wasmExports["gaudio_ChannelGetStreamId"];
  Module["_gaudio_ChannelSetPitch"] = _gaudio_ChannelSetPitch = wasmExports["gaudio_ChannelSetPitch"];
  Module["_gaudio_ChannelGetPitch"] = _gaudio_ChannelGetPitch = wasmExports["gaudio_ChannelGetPitch"];
  Module["_gaudio_ChannelSetLooping"] = _gaudio_ChannelSetLooping = wasmExports["gaudio_ChannelSetLooping"];
  Module["_gaudio_ChannelIsLooping"] = _gaudio_ChannelIsLooping = wasmExports["gaudio_ChannelIsLooping"];
  Module["_gaudio_ChannelSetWorldPosition"] = _gaudio_ChannelSetWorldPosition = wasmExports["gaudio_ChannelSetWorldPosition"];
  Module["_gaudio_ChannelSetEffect"] = _gaudio_ChannelSetEffect = wasmExports["gaudio_ChannelSetEffect"];
  Module["_gaudio_ChannelAddCallback"] = _gaudio_ChannelAddCallback = wasmExports["gaudio_ChannelAddCallback"];
  Module["_gaudio_ChannelRemoveCallback"] = _gaudio_ChannelRemoveCallback = wasmExports["gaudio_ChannelRemoveCallback"];
  Module["_gaudio_ChannelRemoveCallbackWithGid"] = _gaudio_ChannelRemoveCallbackWithGid = wasmExports["gaudio_ChannelRemoveCallbackWithGid"];
  Module["_gaudio_BackgroundMusicIsAvailable"] = _gaudio_BackgroundMusicIsAvailable = wasmExports["gaudio_BackgroundMusicIsAvailable"];
  Module["_gaudio_BackgroundMusicCreateFromFile"] = _gaudio_BackgroundMusicCreateFromFile = wasmExports["gaudio_BackgroundMusicCreateFromFile"];
  Module["_gaudio_BackgroundMusicDelete"] = _gaudio_BackgroundMusicDelete = wasmExports["gaudio_BackgroundMusicDelete"];
  Module["_gaudio_BackgroundMusicGetLength"] = _gaudio_BackgroundMusicGetLength = wasmExports["gaudio_BackgroundMusicGetLength"];
  Module["_gaudio_BackgroundMusicPlay"] = _gaudio_BackgroundMusicPlay = wasmExports["gaudio_BackgroundMusicPlay"];
  Module["_gaudio_BackgroundChannelStop"] = _gaudio_BackgroundChannelStop = wasmExports["gaudio_BackgroundChannelStop"];
  Module["_gaudio_BackgroundChannelSetPosition"] = _gaudio_BackgroundChannelSetPosition = wasmExports["gaudio_BackgroundChannelSetPosition"];
  Module["_gaudio_BackgroundChannelGetPosition"] = _gaudio_BackgroundChannelGetPosition = wasmExports["gaudio_BackgroundChannelGetPosition"];
  Module["_gaudio_BackgroundChannelSetPaused"] = _gaudio_BackgroundChannelSetPaused = wasmExports["gaudio_BackgroundChannelSetPaused"];
  Module["_gaudio_BackgroundChannelIsPaused"] = _gaudio_BackgroundChannelIsPaused = wasmExports["gaudio_BackgroundChannelIsPaused"];
  Module["_gaudio_BackgroundChannelIsPlaying"] = _gaudio_BackgroundChannelIsPlaying = wasmExports["gaudio_BackgroundChannelIsPlaying"];
  Module["_gaudio_BackgroundChannelSetVolume"] = _gaudio_BackgroundChannelSetVolume = wasmExports["gaudio_BackgroundChannelSetVolume"];
  Module["_gaudio_BackgroundChannelGetVolume"] = _gaudio_BackgroundChannelGetVolume = wasmExports["gaudio_BackgroundChannelGetVolume"];
  Module["_gaudio_BackgroundChannelSetLooping"] = _gaudio_BackgroundChannelSetLooping = wasmExports["gaudio_BackgroundChannelSetLooping"];
  Module["_gaudio_BackgroundChannelIsLooping"] = _gaudio_BackgroundChannelIsLooping = wasmExports["gaudio_BackgroundChannelIsLooping"];
  Module["_gaudio_BackgroundChannelAddCallback"] = _gaudio_BackgroundChannelAddCallback = wasmExports["gaudio_BackgroundChannelAddCallback"];
  Module["_gaudio_BackgroundChannelRemoveCallback"] = _gaudio_BackgroundChannelRemoveCallback = wasmExports["gaudio_BackgroundChannelRemoveCallback"];
  Module["_gaudio_BackgroundChannelRemoveCallbackWithGid"] = _gaudio_BackgroundChannelRemoveCallbackWithGid = wasmExports["gaudio_BackgroundChannelRemoveCallbackWithGid"];
  Module["_gaudio_AdvanceStreamBuffers"] = _gaudio_AdvanceStreamBuffers = wasmExports["gaudio_AdvanceStreamBuffers"];
  Module["_gaudio_registerType"] = _gaudio_registerType = wasmExports["gaudio_registerType"];
  Module["_gaudio_unregisterType"] = _gaudio_unregisterType = wasmExports["gaudio_unregisterType"];
  Module["_gaudio_registerEncoderType"] = _gaudio_registerEncoderType = wasmExports["gaudio_registerEncoderType"];
  Module["_gaudio_unregisterEncoderType"] = _gaudio_unregisterEncoderType = wasmExports["gaudio_unregisterEncoderType"];
  Module["_gaudio_lookupEncoder"] = _gaudio_lookupEncoder = wasmExports["gaudio_lookupEncoder"];
  Module["_gaudio_WavOpen"] = _gaudio_WavOpen = wasmExports["gaudio_WavOpen"];
  Module["_gaudio_WavClose"] = _gaudio_WavClose = wasmExports["gaudio_WavClose"];
  Module["_gaudio_WavSeek"] = _gaudio_WavSeek = wasmExports["gaudio_WavSeek"];
  Module["_gaudio_WavTell"] = _gaudio_WavTell = wasmExports["gaudio_WavTell"];
  Module["_gaudio_WavRead"] = _gaudio_WavRead = wasmExports["gaudio_WavRead"];
  Module["_gvfs_init"] = _gvfs_init = wasmExports["gvfs_init"];
  Module["_gvfs_setCodeKey"] = _gvfs_setCodeKey = wasmExports["gvfs_setCodeKey"];
  Module["_gvfs_setAssetsKey"] = _gvfs_setAssetsKey = wasmExports["gvfs_setAssetsKey"];
  Module["_gvfs_cleanup"] = _gvfs_cleanup = wasmExports["gvfs_cleanup"];
  Module["_gvfs_setZipFile"] = _gvfs_setZipFile = wasmExports["gvfs_setZipFile"];
  Module["_gvfs_addFile"] = _gvfs_addFile = wasmExports["gvfs_addFile"];
  Module["__ZN11GReferenced3refEv"] = __ZN11GReferenced3refEv = wasmExports["_ZN11GReferenced3refEv"];
  Module["__ZN11GReferenced5unrefEv"] = __ZN11GReferenced5unrefEv = wasmExports["_ZN11GReferenced5unrefEv"];
  Module["__ZNK11GReferenced5proxyEv"] = __ZNK11GReferenced5proxyEv = wasmExports["_ZNK11GReferenced5proxyEv"];
  Module["__ZN11GReferencedC2Ev"] = __ZN11GReferencedC2Ev = wasmExports["_ZN11GReferencedC2Ev"];
  Module["__ZN11GReferencedD2Ev"] = __ZN11GReferencedD2Ev = wasmExports["_ZN11GReferencedD2Ev"];
  Module["__ZN8StringId8instanceEv"] = __ZN8StringId8instanceEv = wasmExports["_ZN8StringId8instanceEv"];
  Module["__ZN8StringId2idEPKc"] = __ZN8StringId2idEPKc = wasmExports["_ZN8StringId2idEPKc"];
  Module["_lua_toboolean2"] = _lua_toboolean2 = wasmExports["lua_toboolean2"];
  Module["_luaL_newweaktable"] = _luaL_newweaktable = wasmExports["luaL_newweaktable"];
  Module["_luaL_nullifytable"] = _luaL_nullifytable = wasmExports["luaL_nullifytable"];
  Module["_luaC_traceback"] = _luaC_traceback = wasmExports["luaC_traceback"];
  Module["_lua_pcall_traceback"] = _lua_pcall_traceback = wasmExports["lua_pcall_traceback"];
  Module["_lua_traceback"] = _lua_traceback = wasmExports["lua_traceback"];
  Module["_luaL_rawgetptr"] = _luaL_rawgetptr = wasmExports["luaL_rawgetptr"];
  Module["_luaL_rawsetptr"] = _luaL_rawsetptr = wasmExports["luaL_rawsetptr"];
  Module["_luaL_setdata"] = _luaL_setdata = wasmExports["luaL_setdata"];
  Module["_luaL_getdata"] = _luaL_getdata = wasmExports["luaL_getdata"];
  Module["_g_registerPlugin"] = _g_registerPlugin = wasmExports["g_registerPlugin"];
  Module["_g_registerOpenUrlCallback"] = _g_registerOpenUrlCallback = wasmExports["g_registerOpenUrlCallback"];
  Module["_g_registerEnterFrameCallback"] = _g_registerEnterFrameCallback = wasmExports["g_registerEnterFrameCallback"];
  Module["_g_registerSuspendCallback"] = _g_registerSuspendCallback = wasmExports["g_registerSuspendCallback"];
  Module["_g_registerResumeCallback"] = _g_registerResumeCallback = wasmExports["g_registerResumeCallback"];
  Module["_g_registerForegroundCallback"] = _g_registerForegroundCallback = wasmExports["g_registerForegroundCallback"];
  Module["_g_registerBackgroundCallback"] = _g_registerBackgroundCallback = wasmExports["g_registerBackgroundCallback"];
  Module["_g_registerInterruptCallback"] = _g_registerInterruptCallback = wasmExports["g_registerInterruptCallback"];
  Module["_g_initializeBinderState"] = _g_initializeBinderState = wasmExports["g_initializeBinderState"];
  Module["_g_disableTypeChecking"] = _g_disableTypeChecking = wasmExports["g_disableTypeChecking"];
  Module["_g_enableTypeChecking"] = _g_enableTypeChecking = wasmExports["g_enableTypeChecking"];
  Module["_g_isTypeCheckingEnabled"] = _g_isTypeCheckingEnabled = wasmExports["g_isTypeCheckingEnabled"];
  Module["_g_createClass"] = _g_createClass = wasmExports["g_createClass"];
  Module["_g_makeInstance"] = _g_makeInstance = wasmExports["g_makeInstance"];
  Module["_g_pushInstance"] = _g_pushInstance = wasmExports["g_pushInstance"];
  Module["_g_isInstanceOf"] = _g_isInstanceOf = wasmExports["g_isInstanceOf"];
  Module["_g_getInstance"] = _g_getInstance = wasmExports["g_getInstance"];
  Module["_g_getInstanceOfType"] = _g_getInstanceOfType = wasmExports["g_getInstanceOfType"];
  Module["_g_setInstance"] = _g_setInstance = wasmExports["g_setInstance"];
  Module["_g_error"] = _g_error = wasmExports["g_error"];
  Module["__ZN6GProxyC2ENS_5GTypeE"] = __ZN6GProxyC2ENS_5GTypeE = wasmExports["_ZN6GProxyC2ENS_5GTypeE"];
  Module["__ZN6GProxyD2Ev"] = __ZN6GProxyD2Ev = wasmExports["_ZN6GProxyD2Ev"];
  Module["__ZN21GEventDispatcherProxyC2EN6GProxy5GTypeE"] = __ZN21GEventDispatcherProxyC2EN6GProxy5GTypeE = wasmExports["_ZN21GEventDispatcherProxyC2EN6GProxy5GTypeE"];
  Module["__ZN21GEventDispatcherProxyD0Ev"] = __ZN21GEventDispatcherProxyD0Ev = wasmExports["_ZN21GEventDispatcherProxyD0Ev"];
  Module["__ZN21GEventDispatcherProxyD1Ev"] = __ZN21GEventDispatcherProxyD1Ev = wasmExports["_ZN21GEventDispatcherProxyD1Ev"];
  Module["__ZN21GEventDispatcherProxyC1EN6GProxy5GTypeE"] = __ZN21GEventDispatcherProxyC1EN6GProxy5GTypeE = wasmExports["_ZN21GEventDispatcherProxyC1EN6GProxy5GTypeE"];
  Module["__ZN21GEventDispatcherProxyD2Ev"] = __ZN21GEventDispatcherProxyD2Ev = wasmExports["_ZN21GEventDispatcherProxyD2Ev"];
  Module["_g_clearerr"] = _g_clearerr = wasmExports["g_clearerr"];
  Module["_g_fclose"] = _g_fclose = wasmExports["g_fclose"];
  Module["_g_feof"] = _g_feof = wasmExports["g_feof"];
  Module["_g_ferror"] = _g_ferror = wasmExports["g_ferror"];
  Module["_g_fflush"] = _g_fflush = wasmExports["g_fflush"];
  Module["_g_fgetc"] = _g_fgetc = wasmExports["g_fgetc"];
  Module["_g_fgets"] = _g_fgets = wasmExports["g_fgets"];
  Module["_g_setVfs"] = _g_setVfs = wasmExports["g_setVfs"];
  Module["_g_flockfile"] = _g_flockfile = wasmExports["g_flockfile"];
  Module["_g_ftrylockfile"] = _g_ftrylockfile = wasmExports["g_ftrylockfile"];
  Module["_g_funlockfile"] = _g_funlockfile = wasmExports["g_funlockfile"];
  Module["_g_fopen"] = _g_fopen = wasmExports["g_fopen"];
  Module["_g_fprintf"] = _g_fprintf = wasmExports["g_fprintf"];
  Module["_g_fread"] = _g_fread = wasmExports["g_fread"];
  Module["_g_fscanf"] = _g_fscanf = wasmExports["g_fscanf"];
  Module["_g_fseek"] = _g_fseek = wasmExports["g_fseek"];
  Module["_g_ftell"] = _g_ftell = wasmExports["g_ftell"];
  Module["_g_fwrite"] = _g_fwrite = wasmExports["g_fwrite"];
  Module["_g_getc"] = _g_getc = wasmExports["g_getc"];
  Module["_g_setvbuf"] = _g_setvbuf = wasmExports["g_setvbuf"];
  Module["_g_tmpfile"] = _g_tmpfile = wasmExports["g_tmpfile"];
  Module["_g_ungetc"] = _g_ungetc = wasmExports["g_ungetc"];
  Module["_g_vfprintf"] = _g_vfprintf = wasmExports["g_vfprintf"];
  Module["_g_vfscanf"] = _g_vfscanf = wasmExports["g_vfscanf"];
  Module["_g_pathForFile"] = _g_pathForFile = wasmExports["g_pathForFile"];
  Module["__Z21getDocumentsDirectoryv"] = __Z21getDocumentsDirectoryv = wasmExports["_Z21getDocumentsDirectoryv"];
  Module["__Z21getTemporaryDirectoryv"] = __Z21getTemporaryDirectoryv = wasmExports["_Z21getTemporaryDirectoryv"];
  Module["__Z20getResourceDirectoryv"] = __Z20getResourceDirectoryv = wasmExports["_Z20getResourceDirectoryv"];
  Module["__Z21setDocumentsDirectoryPKc"] = __Z21setDocumentsDirectoryPKc = wasmExports["_Z21setDocumentsDirectoryPKc"];
  Module["__Z21setTemporaryDirectoryPKc"] = __Z21setTemporaryDirectoryPKc = wasmExports["_Z21setTemporaryDirectoryPKc"];
  Module["__Z20setResourceDirectoryPKc"] = __Z20setResourceDirectoryPKc = wasmExports["_Z20setResourceDirectoryPKc"];
  Module["__Z13pathForFileExPKcS0_"] = __Z13pathForFileExPKcS0_ = wasmExports["_Z13pathForFileExPKcS0_"];
  Module["__Z11getFileTypePKc"] = __Z11getFileTypePKc = wasmExports["_Z11getFileTypePKc"];
  Module["_gpath_init"] = _gpath_init = wasmExports["gpath_init"];
  Module["_gpath_cleanup"] = _gpath_cleanup = wasmExports["gpath_cleanup"];
  Module["_gpath_setDrivePath"] = _gpath_setDrivePath = wasmExports["gpath_setDrivePath"];
  Module["_gpath_setDriveFlags"] = _gpath_setDriveFlags = wasmExports["gpath_setDriveFlags"];
  Module["_gpath_addDrivePrefix"] = _gpath_addDrivePrefix = wasmExports["gpath_addDrivePrefix"];
  Module["_gpath_setDriveVfs"] = _gpath_setDriveVfs = wasmExports["gpath_setDriveVfs"];
  Module["_gpath_setDefaultDrive"] = _gpath_setDefaultDrive = wasmExports["gpath_setDefaultDrive"];
  Module["_gpath_getDefaultDrive"] = _gpath_getDefaultDrive = wasmExports["gpath_getDefaultDrive"];
  Module["_gpath_getDrivePath"] = _gpath_getDrivePath = wasmExports["gpath_getDrivePath"];
  Module["_gpath_getDriveFlags"] = _gpath_getDriveFlags = wasmExports["gpath_getDriveFlags"];
  Module["_gpath_getDriveVfs"] = _gpath_getDriveVfs = wasmExports["gpath_getDriveVfs"];
  Module["_gpath_setAbsolutePathFlags"] = _gpath_setAbsolutePathFlags = wasmExports["gpath_setAbsolutePathFlags"];
  Module["_gpath_getPathDrive"] = _gpath_getPathDrive = wasmExports["gpath_getPathDrive"];
  Module["_gpath_join"] = _gpath_join = wasmExports["gpath_join"];
  Module["_gpath_transform"] = _gpath_transform = wasmExports["gpath_transform"];
  Module["_gpath_normalizeArchivePath"] = _gpath_normalizeArchivePath = wasmExports["gpath_normalizeArchivePath"];
  Module["_lua_checkstack"] = _lua_checkstack = wasmExports["lua_checkstack"];
  Module["_lua_gettop"] = _lua_gettop = wasmExports["lua_gettop"];
  Module["_lua_settop"] = _lua_settop = wasmExports["lua_settop"];
  Module["_lua_remove"] = _lua_remove = wasmExports["lua_remove"];
  Module["_lua_insert"] = _lua_insert = wasmExports["lua_insert"];
  Module["_lua_replace"] = _lua_replace = wasmExports["lua_replace"];
  Module["_lua_pushvalue"] = _lua_pushvalue = wasmExports["lua_pushvalue"];
  Module["_lua_type"] = _lua_type = wasmExports["lua_type"];
  Module["_lua_typename"] = _lua_typename = wasmExports["lua_typename"];
  Module["_lua_isnumber"] = _lua_isnumber = wasmExports["lua_isnumber"];
  Module["_lua_isstring"] = _lua_isstring = wasmExports["lua_isstring"];
  Module["_lua_tonumberx"] = _lua_tonumberx = wasmExports["lua_tonumberx"];
  Module["_lua_tointegerx"] = _lua_tointegerx = wasmExports["lua_tointegerx"];
  Module["_lua_tounsignedx"] = _lua_tounsignedx = wasmExports["lua_tounsignedx"];
  Module["_lua_toboolean"] = _lua_toboolean = wasmExports["lua_toboolean"];
  Module["_lua_tolstring"] = _lua_tolstring = wasmExports["lua_tolstring"];
  Module["_lua_objlen"] = _lua_objlen = wasmExports["lua_objlen"];
  Module["_lua_touserdata"] = _lua_touserdata = wasmExports["lua_touserdata"];
  Module["_lua_topointer"] = _lua_topointer = wasmExports["lua_topointer"];
  Module["_lua_pushnil"] = _lua_pushnil = wasmExports["lua_pushnil"];
  Module["_lua_pushnumber"] = _lua_pushnumber = wasmExports["lua_pushnumber"];
  Module["_lua_pushinteger"] = _lua_pushinteger = wasmExports["lua_pushinteger"];
  Module["_lua_pushvector"] = _lua_pushvector = wasmExports["lua_pushvector"];
  Module["_lua_pushcolorf"] = _lua_pushcolorf = wasmExports["lua_pushcolorf"];
  Module["_lua_pushlstring"] = _lua_pushlstring = wasmExports["lua_pushlstring"];
  Module["_lua_pushstring"] = _lua_pushstring = wasmExports["lua_pushstring"];
  Module["_lua_pushfstringL"] = _lua_pushfstringL = wasmExports["lua_pushfstringL"];
  Module["_lua_pushcclosurek"] = _lua_pushcclosurek = wasmExports["lua_pushcclosurek"];
  Module["_lua_pushboolean"] = _lua_pushboolean = wasmExports["lua_pushboolean"];
  Module["_lua_pushlightuserdatatagged"] = _lua_pushlightuserdatatagged = wasmExports["lua_pushlightuserdatatagged"];
  Module["_lua_gettable"] = _lua_gettable = wasmExports["lua_gettable"];
  Module["_lua_getfield"] = _lua_getfield = wasmExports["lua_getfield"];
  Module["_lua_rawgetfield"] = _lua_rawgetfield = wasmExports["lua_rawgetfield"];
  Module["_lua_rawget"] = _lua_rawget = wasmExports["lua_rawget"];
  Module["_lua_rawgeti"] = _lua_rawgeti = wasmExports["lua_rawgeti"];
  Module["_lua_createtable"] = _lua_createtable = wasmExports["lua_createtable"];
  Module["_lua_getmetatable"] = _lua_getmetatable = wasmExports["lua_getmetatable"];
  Module["_lua_settable"] = _lua_settable = wasmExports["lua_settable"];
  Module["_lua_setfield"] = _lua_setfield = wasmExports["lua_setfield"];
  Module["_lua_rawset"] = _lua_rawset = wasmExports["lua_rawset"];
  Module["_lua_rawseti"] = _lua_rawseti = wasmExports["lua_rawseti"];
  Module["_lua_setmetatable"] = _lua_setmetatable = wasmExports["lua_setmetatable"];
  Module["_lua_call"] = _lua_call = wasmExports["lua_call"];
  Module["_lua_pcall"] = _lua_pcall = wasmExports["lua_pcall"];
  Module["_lua_error"] = _lua_error = wasmExports["lua_error"];
  Module["_lua_next"] = _lua_next = wasmExports["lua_next"];
  Module["_lua_newuserdatatagged"] = _lua_newuserdatatagged = wasmExports["lua_newuserdatatagged"];
  Module["_lua_newuserdatadtor"] = _lua_newuserdatadtor = wasmExports["lua_newuserdatadtor"];
  Module["_lua_ref"] = _lua_ref = wasmExports["lua_ref"];
  Module["_lua_unref"] = _lua_unref = wasmExports["lua_unref"];
  Module["_luaL_argerrorL"] = _luaL_argerrorL = wasmExports["luaL_argerrorL"];
  Module["_luaL_errorL"] = _luaL_errorL = wasmExports["luaL_errorL"];
  Module["_luaL_typeerrorL"] = _luaL_typeerrorL = wasmExports["luaL_typeerrorL"];
  Module["_luaL_checkoption"] = _luaL_checkoption = wasmExports["luaL_checkoption"];
  Module["_luaL_optlstring"] = _luaL_optlstring = wasmExports["luaL_optlstring"];
  Module["_luaL_checklstring"] = _luaL_checklstring = wasmExports["luaL_checklstring"];
  Module["_luaL_newmetatable"] = _luaL_newmetatable = wasmExports["luaL_newmetatable"];
  Module["_luaL_checkudata"] = _luaL_checkudata = wasmExports["luaL_checkudata"];
  Module["_luaL_checkstack"] = _luaL_checkstack = wasmExports["luaL_checkstack"];
  Module["_luaL_checktype"] = _luaL_checktype = wasmExports["luaL_checktype"];
  Module["_luaL_checknumber"] = _luaL_checknumber = wasmExports["luaL_checknumber"];
  Module["_luaL_optnumber"] = _luaL_optnumber = wasmExports["luaL_optnumber"];
  Module["_luaL_optboolean"] = _luaL_optboolean = wasmExports["luaL_optboolean"];
  Module["_luaL_checkinteger"] = _luaL_checkinteger = wasmExports["luaL_checkinteger"];
  Module["_luaL_optinteger"] = _luaL_optinteger = wasmExports["luaL_optinteger"];
  Module["_luaL_register"] = _luaL_register = wasmExports["luaL_register"];
  Module["_luaL_typename"] = _luaL_typename = wasmExports["luaL_typename"];
  Module["_luaL_pushresult"] = _luaL_pushresult = wasmExports["luaL_pushresult"];
  Module["_luaL_buffinit"] = _luaL_buffinit = wasmExports["luaL_buffinit"];
  Module["_luaL_addlstring"] = _luaL_addlstring = wasmExports["luaL_addlstring"];
  Module["_luaL_prepbuffsize"] = _luaL_prepbuffsize = wasmExports["luaL_prepbuffsize"];
  Module["_luaL_ref"] = _luaL_ref = wasmExports["luaL_ref"];
  Module["_lua_isclosing"] = _lua_isclosing = wasmExports["lua_isclosing"];
  Module["___cxa_atexit"] = ___cxa_atexit = wasmExports["__cxa_atexit"];
  Module["___errno_location"] = ___errno_location = wasmExports["__errno_location"];
  Module["_abort"] = _abort = wasmExports["abort"];
  Module["_access"] = _access = wasmExports["access"];
  Module["_acos"] = _acos = wasmExports["acos"];
  Module["_acosf"] = _acosf = wasmExports["acosf"];
  Module["_atan"] = _atan = wasmExports["atan"];
  Module["_atan2"] = _atan2 = wasmExports["atan2"];
  Module["_atan2f"] = _atan2f = wasmExports["atan2f"];
  Module["_atof"] = _atof = wasmExports["atof"];
  Module["_bsearch"] = _bsearch = wasmExports["bsearch"];
  Module["_chdir"] = _chdir = wasmExports["chdir"];
  Module["_close"] = _close = wasmExports["close"];
  Module["_closedir"] = _closedir = wasmExports["closedir"];
  Module["_cos"] = _cos = wasmExports["cos"];
  Module["_cosf"] = _cosf = wasmExports["cosf"];
  ___dl_seterr = wasmExports["__dl_seterr"];
  __emscripten_find_dylib = wasmExports["_emscripten_find_dylib"];
  Module["_time"] = _time = wasmExports["time"];
  Module["_gettimeofday"] = _gettimeofday = wasmExports["gettimeofday"];
  Module["_exp"] = _exp = wasmExports["exp"];
  Module["_exp2"] = _exp2 = wasmExports["exp2"];
  Module["_fchmod"] = _fchmod = wasmExports["fchmod"];
  Module["_fchown"] = _fchown = wasmExports["fchown"];
  Module["_fclose"] = _fclose = wasmExports["fclose"];
  Module["_fcntl"] = _fcntl = wasmExports["fcntl"];
  Module["_fileno"] = _fileno = wasmExports["fileno"];
  Module["_fmax"] = _fmax = wasmExports["fmax"];
  Module["_fmin"] = _fmin = wasmExports["fmin"];
  Module["_fmodf"] = _fmodf = wasmExports["fmodf"];
  Module["_fopen"] = _fopen = wasmExports["fopen"];
  Module["_fiprintf"] = _fiprintf = wasmExports["fiprintf"];
  Module["___small_fprintf"] = ___small_fprintf = wasmExports["__small_fprintf"];
  Module["_fputc"] = _fputc = wasmExports["fputc"];
  Module["_fstat"] = _fstat = wasmExports["fstat"];
  Module["_fsync"] = _fsync = wasmExports["fsync"];
  Module["_ftruncate"] = _ftruncate = wasmExports["ftruncate"];
  Module["_fwrite"] = _fwrite = wasmExports["fwrite"];
  Module["_gai_strerror"] = _gai_strerror = wasmExports["gai_strerror"];
  Module["_getcwd"] = _getcwd = wasmExports["getcwd"];
  Module["_getenv"] = _getenv = wasmExports["getenv"];
  Module["_geteuid"] = _geteuid = wasmExports["geteuid"];
  Module["_gethostname"] = _gethostname = wasmExports["gethostname"];
  Module["_getpid"] = _getpid = wasmExports["getpid"];
  Module["___h_errno_location"] = ___h_errno_location = wasmExports["__h_errno_location"];
  Module["_hstrerror"] = _hstrerror = wasmExports["hstrerror"];
  Module["_htonl"] = _htonl = wasmExports["htonl"];
  _htons = wasmExports["htons"];
  Module["_inet_ntoa"] = _inet_ntoa = wasmExports["inet_ntoa"];
  Module["_isalnum"] = _isalnum = wasmExports["isalnum"];
  Module["_isblank"] = _isblank = wasmExports["isblank"];
  Module["_isspace"] = _isspace = wasmExports["isspace"];
  Module["_ldexp"] = _ldexp = wasmExports["ldexp"];
  Module["_pthread_mutex_init"] = _pthread_mutex_init = wasmExports["pthread_mutex_init"];
  Module["_pthread_mutex_destroy"] = _pthread_mutex_destroy = wasmExports["pthread_mutex_destroy"];
  Module["_pthread_mutexattr_init"] = _pthread_mutexattr_init = wasmExports["pthread_mutexattr_init"];
  Module["_pthread_mutexattr_settype"] = _pthread_mutexattr_settype = wasmExports["pthread_mutexattr_settype"];
  Module["_pthread_mutexattr_destroy"] = _pthread_mutexattr_destroy = wasmExports["pthread_mutexattr_destroy"];
  Module["_pthread_mutex_lock"] = _pthread_mutex_lock = wasmExports["pthread_mutex_lock"];
  Module["_pthread_mutex_unlock"] = _pthread_mutex_unlock = wasmExports["pthread_mutex_unlock"];
  Module["_pthread_mutex_trylock"] = _pthread_mutex_trylock = wasmExports["pthread_mutex_trylock"];
  Module["_link"] = _link = wasmExports["link"];
  Module["_localtime"] = _localtime = wasmExports["localtime"];
  Module["_log"] = _log = wasmExports["log"];
  Module["_log10"] = _log10 = wasmExports["log10"];
  Module["_logf"] = _logf = wasmExports["logf"];
  Module["_lrintf"] = _lrintf = wasmExports["lrintf"];
  Module["_lseek"] = _lseek = wasmExports["lseek"];
  Module["_lstat"] = _lstat = wasmExports["lstat"];
  Module["_memchr"] = _memchr = wasmExports["memchr"];
  Module["_memcmp"] = _memcmp = wasmExports["memcmp"];
  Module["_mkdir"] = _mkdir = wasmExports["mkdir"];
  Module["___mmap"] = ___mmap = wasmExports["__mmap"];
  Module["___munmap"] = ___munmap = wasmExports["__munmap"];
  Module["_nanosleep"] = _nanosleep = wasmExports["nanosleep"];
  _ntohs = wasmExports["ntohs"];
  Module["_open"] = _open = wasmExports["open"];
  Module["_opendir"] = _opendir = wasmExports["opendir"];
  Module["_poll"] = _poll = wasmExports["poll"];
  Module["_pow"] = _pow = wasmExports["pow"];
  Module["_powf"] = _powf = wasmExports["powf"];
  Module["_iprintf"] = _iprintf = wasmExports["iprintf"];
  Module["_qsort"] = _qsort = wasmExports["qsort"];
  Module["_srand"] = _srand = wasmExports["srand"];
  Module["_rand"] = _rand = wasmExports["rand"];
  Module["_read"] = _read = wasmExports["read"];
  Module["_readdir"] = _readdir = wasmExports["readdir"];
  Module["_readlink"] = _readlink = wasmExports["readlink"];
  Module["_rmdir"] = _rmdir = wasmExports["rmdir"];
  Module["_round"] = _round = wasmExports["round"];
  Module["_select"] = _select = wasmExports["select"];
  Module["_setlocale"] = _setlocale = wasmExports["setlocale"];
  Module["_signal"] = _signal = wasmExports["signal"];
  Module["_sin"] = _sin = wasmExports["sin"];
  Module["_sinf"] = _sinf = wasmExports["sinf"];
  Module["_sleep"] = _sleep = wasmExports["sleep"];
  Module["_snprintf"] = _snprintf = wasmExports["snprintf"];
  Module["_siprintf"] = _siprintf = wasmExports["siprintf"];
  Module["___small_sprintf"] = ___small_sprintf = wasmExports["__small_sprintf"];
  Module["_sscanf"] = _sscanf = wasmExports["sscanf"];
  Module["_stat"] = _stat = wasmExports["stat"];
  Module["_strcasecmp"] = _strcasecmp = wasmExports["strcasecmp"];
  Module["_strcat"] = _strcat = wasmExports["strcat"];
  Module["_strchr"] = _strchr = wasmExports["strchr"];
  Module["_strcmp"] = _strcmp = wasmExports["strcmp"];
  Module["_strcpy"] = _strcpy = wasmExports["strcpy"];
  Module["_strerror"] = _strerror = wasmExports["strerror"];
  Module["_strftime"] = _strftime = wasmExports["strftime"];
  Module["_strlen"] = _strlen = wasmExports["strlen"];
  Module["_strncasecmp"] = _strncasecmp = wasmExports["strncasecmp"];
  Module["_strncat"] = _strncat = wasmExports["strncat"];
  Module["_strncmp"] = _strncmp = wasmExports["strncmp"];
  Module["_strncpy"] = _strncpy = wasmExports["strncpy"];
  Module["_strrchr"] = _strrchr = wasmExports["strrchr"];
  Module["_strstr"] = _strstr = wasmExports["strstr"];
  Module["_strtod"] = _strtod = wasmExports["strtod"];
  Module["_strtoul"] = _strtoul = wasmExports["strtoul"];
  Module["_strtol"] = _strtol = wasmExports["strtol"];
  Module["_symlink"] = _symlink = wasmExports["symlink"];
  Module["_tan"] = _tan = wasmExports["tan"];
  Module["_toupper"] = _toupper = wasmExports["toupper"];
  Module["_unlink"] = _unlink = wasmExports["unlink"];
  Module["_utime"] = _utime = wasmExports["utime"];
  Module["_utimes"] = _utimes = wasmExports["utimes"];
  Module["_vfprintf"] = _vfprintf = wasmExports["vfprintf"];
  Module["_vsnprintf"] = _vsnprintf = wasmExports["vsnprintf"];
  Module["_wcslen"] = _wcslen = wasmExports["wcslen"];
  Module["_write"] = _write = wasmExports["write"];
  Module["_malloc"] = _malloc = wasmExports["malloc"];
  Module["_free"] = _free = wasmExports["free"];
  Module["_calloc"] = _calloc = wasmExports["calloc"];
  Module["_realloc"] = _realloc = wasmExports["realloc"];
  Module["_posix_memalign"] = _posix_memalign = wasmExports["posix_memalign"];
  _emscripten_builtin_memalign = wasmExports["emscripten_builtin_memalign"];
  ___trap = wasmExports["__trap"];
  Module["___addtf3"] = ___addtf3 = wasmExports["__addtf3"];
  Module["___getf2"] = ___getf2 = wasmExports["__getf2"];
  Module["___lttf2"] = ___lttf2 = wasmExports["__lttf2"];
  Module["___gttf2"] = ___gttf2 = wasmExports["__gttf2"];
  Module["___divtf3"] = ___divtf3 = wasmExports["__divtf3"];
  __emscripten_tempret_set = wasmExports["_emscripten_tempret_set"];
  __emscripten_tempret_get = wasmExports["_emscripten_tempret_get"];
  Module["___extenddftf2"] = ___extenddftf2 = wasmExports["__extenddftf2"];
  Module["___fixtfsi"] = ___fixtfsi = wasmExports["__fixtfsi"];
  Module["___floatditf"] = ___floatditf = wasmExports["__floatditf"];
  Module["___floatsitf"] = ___floatsitf = wasmExports["__floatsitf"];
  Module["___multf3"] = ___multf3 = wasmExports["__multf3"];
  __emscripten_stack_restore = wasmExports["_emscripten_stack_restore"];
  __emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"];
  _emscripten_stack_get_current = wasmExports["emscripten_stack_get_current"];
  Module["___subtf3"] = ___subtf3 = wasmExports["__subtf3"];
  Module["___trunctfdf2"] = ___trunctfdf2 = wasmExports["__trunctfdf2"];
  Module["__ZNSt3__26chrono12system_clock3nowEv"] = __ZNSt3__26chrono12system_clock3nowEv = wasmExports["_ZNSt3__26chrono12system_clock3nowEv"];
  Module["__ZNSt13exception_ptrD1Ev"] = __ZNSt13exception_ptrD1Ev = wasmExports["_ZNSt13exception_ptrD1Ev"];
  Module["__ZNSt13exception_ptrC1ERKS_"] = __ZNSt13exception_ptrC1ERKS_ = wasmExports["_ZNSt13exception_ptrC1ERKS_"];
  Module["__ZSt17rethrow_exceptionSt13exception_ptr"] = __ZSt17rethrow_exceptionSt13exception_ptr = wasmExports["_ZSt17rethrow_exceptionSt13exception_ptr"];
  Module["__ZNSt3__217__assoc_sub_state10__sub_waitERNS_11unique_lockINS_5mutexEEE"] = __ZNSt3__217__assoc_sub_state10__sub_waitERNS_11unique_lockINS_5mutexEEE = wasmExports["_ZNSt3__217__assoc_sub_state10__sub_waitERNS_11unique_lockINS_5mutexEEE"];
  Module["__ZNSt3__212__next_primeEm"] = __ZNSt3__212__next_primeEm = wasmExports["_ZNSt3__212__next_primeEm"];
  Module["__ZNSt3__29basic_iosIcNS_11char_traitsIcEEED2Ev"] = __ZNSt3__29basic_iosIcNS_11char_traitsIcEEED2Ev = wasmExports["_ZNSt3__29basic_iosIcNS_11char_traitsIcEEED2Ev"];
  Module["__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE5flushEv"] = __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE5flushEv = wasmExports["_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE5flushEv"];
  Module["__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryC1ERS3_"] = __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryC1ERS3_ = wasmExports["_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryC1ERS3_"];
  Module["__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryD1Ev"] = __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryD1Ev = wasmExports["_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE6sentryD1Ev"];
  Module["__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEb"] = __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEb = wasmExports["_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEb"];
  Module["__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEt"] = __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEt = wasmExports["_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEt"];
  Module["__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEj"] = __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEj = wasmExports["_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEj"];
  Module["__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEf"] = __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEf = wasmExports["_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEElsEf"];
  Module["__ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE3putEc"] = __ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE3putEc = wasmExports["_ZNSt3__213basic_ostreamIcNS_11char_traitsIcEEE3putEc"];
  Module["__ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED2Ev"] = __ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED2Ev = wasmExports["_ZNSt3__214basic_iostreamIcNS_11char_traitsIcEEED2Ev"];
  Module["__ZNKSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE3strEv"] = __ZNKSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE3strEv = wasmExports["_ZNKSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEE3strEv"];
  Module["__ZNKSt3__28ios_base6getlocEv"] = __ZNKSt3__28ios_base6getlocEv = wasmExports["_ZNKSt3__28ios_base6getlocEv"];
  Module["__ZNSt3__28ios_base5clearEj"] = __ZNSt3__28ios_base5clearEj = wasmExports["_ZNSt3__28ios_base5clearEj"];
  Module["__ZNSt3__28ios_base4initEPv"] = __ZNSt3__28ios_base4initEPv = wasmExports["_ZNSt3__28ios_base4initEPv"];
  Module["__ZNSt3__26localeD1Ev"] = __ZNSt3__26localeD1Ev = wasmExports["_ZNSt3__26localeD1Ev"];
  Module["__ZNKSt3__26locale9use_facetERNS0_2idE"] = __ZNKSt3__26locale9use_facetERNS0_2idE = wasmExports["_ZNKSt3__26locale9use_facetERNS0_2idE"];
  Module["__ZNSt3__26localeC1ERKS0_"] = __ZNSt3__26localeC1ERKS0_ = wasmExports["_ZNSt3__26localeC1ERKS0_"];
  Module["__ZNKSt3__26locale4nameEv"] = __ZNKSt3__26locale4nameEv = wasmExports["_ZNKSt3__26locale4nameEv"];
  Module["__ZNSt3__26localeC1Ev"] = __ZNSt3__26localeC1Ev = wasmExports["_ZNSt3__26localeC1Ev"];
  Module["__ZNSt3__219__shared_weak_count14__release_weakEv"] = __ZNSt3__219__shared_weak_count14__release_weakEv = wasmExports["_ZNSt3__219__shared_weak_count14__release_weakEv"];
  Module["__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info"] = __ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info = wasmExports["_ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info"];
  Module["__ZNSt3__219__shared_weak_countD2Ev"] = __ZNSt3__219__shared_weak_countD2Ev = wasmExports["_ZNSt3__219__shared_weak_countD2Ev"];
  Module["__ZNSt3__25mutex4lockEv"] = __ZNSt3__25mutex4lockEv = wasmExports["_ZNSt3__25mutex4lockEv"];
  Module["__ZNSt3__25mutex6unlockEv"] = __ZNSt3__25mutex6unlockEv = wasmExports["_ZNSt3__25mutex6unlockEv"];
  Module["__ZNSt3__25mutexD1Ev"] = __ZNSt3__25mutexD1Ev = wasmExports["_ZNSt3__25mutexD1Ev"];
  Module["__Znwm"] = __Znwm = wasmExports["_Znwm"];
  Module["__ZnwmRKSt9nothrow_t"] = __ZnwmRKSt9nothrow_t = wasmExports["_ZnwmRKSt9nothrow_t"];
  Module["__Znam"] = __Znam = wasmExports["_Znam"];
  Module["__ZdlPv"] = __ZdlPv = wasmExports["_ZdlPv"];
  Module["__ZdlPvm"] = __ZdlPvm = wasmExports["_ZdlPvm"];
  Module["__ZdaPv"] = __ZdaPv = wasmExports["_ZdaPv"];
  Module["__ZNSt3__211regex_errorD1Ev"] = __ZNSt3__211regex_errorD1Ev = wasmExports["_ZNSt3__211regex_errorD1Ev"];
  Module["__ZNSt3__220__get_collation_nameEPKc"] = __ZNSt3__220__get_collation_nameEPKc = wasmExports["_ZNSt3__220__get_collation_nameEPKc"];
  Module["__ZNSt3__215__get_classnameEPKcb"] = __ZNSt3__215__get_classnameEPKcb = wasmExports["_ZNSt3__215__get_classnameEPKcb"];
  Module["__ZNKSt3__223__match_any_but_newlineIcE6__execERNS_7__stateIcEE"] = __ZNKSt3__223__match_any_but_newlineIcE6__execERNS_7__stateIcEE = wasmExports["_ZNKSt3__223__match_any_but_newlineIcE6__execERNS_7__stateIcEE"];
  Module["__ZNSt3__211regex_errorC1ENS_15regex_constants10error_typeE"] = __ZNSt3__211regex_errorC1ENS_15regex_constants10error_typeE = wasmExports["_ZNSt3__211regex_errorC1ENS_15regex_constants10error_typeE"];
  Module["__ZNSt11logic_errorC2EPKc"] = __ZNSt11logic_errorC2EPKc = wasmExports["_ZNSt11logic_errorC2EPKc"];
  Module["__ZNSt13runtime_errorC1EPKc"] = __ZNSt13runtime_errorC1EPKc = wasmExports["_ZNSt13runtime_errorC1EPKc"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEaSEc"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEaSEc = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEaSEc"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE25__init_copy_ctor_externalEPKcm"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE25__init_copy_ctor_externalEPKcm = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE25__init_copy_ctor_externalEPKcm"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_externalEPKcm"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_externalEPKcm = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_externalEPKcm"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_externalEPKc"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_externalEPKc = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_externalEPKc"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEPKcm"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEPKcm = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEPKcm"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6insertEmPKc"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6insertEmPKc = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6insertEmPKc"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_no_aliasILb0EEERS5_PKcm"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_no_aliasILb0EEERS5_PKcm = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_no_aliasILb0EEERS5_PKcm"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_no_aliasILb1EEERS5_PKcm"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_no_aliasILb1EEERS5_PKcm = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE17__assign_no_aliasILb1EEERS5_PKcm"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEPKc"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEPKc = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEPKc"];
  Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6resizeEmc"] = __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6resizeEmc = wasmExports["_ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6resizeEmc"];
  Module["__ZNSt3__2plIcNS_11char_traitsIcEENS_9allocatorIcEEEENS_12basic_stringIT_T0_T1_EEPKS6_RKS9_"] = __ZNSt3__2plIcNS_11char_traitsIcEENS_9allocatorIcEEEENS_12basic_stringIT_T0_T1_EEPKS6_RKS9_ = wasmExports["_ZNSt3__2plIcNS_11char_traitsIcEENS_9allocatorIcEEEENS_12basic_stringIT_T0_T1_EEPKS6_RKS9_"];
  Module["__ZNSt3__29to_stringEi"] = __ZNSt3__29to_stringEi = wasmExports["_ZNSt3__29to_stringEi"];
  Module["__ZNSt3__29to_stringEj"] = __ZNSt3__29to_stringEj = wasmExports["_ZNSt3__29to_stringEj"];
  Module["__ZNSt3__29to_stringEf"] = __ZNSt3__29to_stringEf = wasmExports["_ZNSt3__29to_stringEf"];
  Module["___cxa_allocate_exception"] = ___cxa_allocate_exception = wasmExports["__cxa_allocate_exception"];
  Module["___cxa_throw"] = ___cxa_throw = wasmExports["__cxa_throw"];
  Module["___cxa_pure_virtual"] = ___cxa_pure_virtual = wasmExports["__cxa_pure_virtual"];
  Module["__ZNSt9exceptionD2Ev"] = __ZNSt9exceptionD2Ev = wasmExports["_ZNSt9exceptionD2Ev"];
  Module["__ZNSt20bad_array_new_lengthD1Ev"] = __ZNSt20bad_array_new_lengthD1Ev = wasmExports["_ZNSt20bad_array_new_lengthD1Ev"];
  Module["__ZNSt20bad_array_new_lengthC1Ev"] = __ZNSt20bad_array_new_lengthC1Ev = wasmExports["_ZNSt20bad_array_new_lengthC1Ev"];
  Module["__ZNSt13runtime_errorD1Ev"] = __ZNSt13runtime_errorD1Ev = wasmExports["_ZNSt13runtime_errorD1Ev"];
  Module["__ZNSt12length_errorD1Ev"] = __ZNSt12length_errorD1Ev = wasmExports["_ZNSt12length_errorD1Ev"];
  Module["__Unwind_CallPersonality"] = __Unwind_CallPersonality = wasmExports["_Unwind_CallPersonality"];
  Module["_accept"] = _accept = wasmExports["accept"];
  Module["_bind"] = _bind = wasmExports["bind"];
  Module["_connect"] = _connect = wasmExports["connect"];
  Module["_freeaddrinfo"] = _freeaddrinfo = wasmExports["freeaddrinfo"];
  Module["_gethostbyaddr"] = _gethostbyaddr = wasmExports["gethostbyaddr"];
  Module["_gethostbyname"] = _gethostbyname = wasmExports["gethostbyname"];
  Module["_getpeername"] = _getpeername = wasmExports["getpeername"];
  Module["_getsockname"] = _getsockname = wasmExports["getsockname"];
  Module["_getsockopt"] = _getsockopt = wasmExports["getsockopt"];
  Module["_listen"] = _listen = wasmExports["listen"];
  Module["_recv"] = _recv = wasmExports["recv"];
  Module["_recvfrom"] = _recvfrom = wasmExports["recvfrom"];
  Module["_send"] = _send = wasmExports["send"];
  Module["_sendto"] = _sendto = wasmExports["sendto"];
  Module["_setsockopt"] = _setsockopt = wasmExports["setsockopt"];
  Module["_shutdown"] = _shutdown = wasmExports["shutdown"];
  Module["_socket"] = _socket = wasmExports["socket"];
  ___wasm_apply_data_relocs = wasmExports["__wasm_apply_data_relocs"];
}

var __ZN5Event18APPLICATION_RESIZEE = Module["__ZN5Event18APPLICATION_RESIZEE"] = 364640;

var __ZN15EventDispatcher20allEventDispatchers_E = Module["__ZN15EventDispatcher20allEventDispatchers_E"] = 519924;

var _stderr = Module["_stderr"] = 363800;

var __ZTVNSt3__215basic_streambufIcNS_11char_traitsIcEEEE = Module["__ZTVNSt3__215basic_streambufIcNS_11char_traitsIcEEEE"] = 356380;

var __ZTVNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEEE = Module["__ZTVNSt3__215basic_stringbufIcNS_11char_traitsIcEENS_9allocatorIcEEEE"] = 356628;

var __ZTTNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEEE = Module["__ZTTNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEEE"] = 357008;

var __ZTVNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEEE = Module["__ZTVNSt3__218basic_stringstreamIcNS_11char_traitsIcEENS_9allocatorIcEEEE"] = 356948;

var __ZNSt3__25ctypeIcE2idE = Module["__ZNSt3__25ctypeIcE2idE"] = 392088;

var __ZNSt3__27collateIcE2idE = Module["__ZNSt3__27collateIcE2idE"] = 391736;

var __ZSt7nothrow = Module["__ZSt7nothrow"] = 96672;

var __ZTVN10__cxxabiv120__si_class_type_infoE = Module["__ZTVN10__cxxabiv120__si_class_type_infoE"] = 347856;

var __ZTIPKc = Module["__ZTIPKc"] = 347800;

var __ZTVN10__cxxabiv117__class_type_infoE = Module["__ZTVN10__cxxabiv117__class_type_infoE"] = 347816;

var __ZTVSt12length_error = Module["__ZTVSt12length_error"] = 348148;

var ___wasm_lpad_context = Module["___wasm_lpad_context"] = 391296;

var wasmImports = {
  /** @export */ __assert_fail: ___assert_fail,
  /** @export */ __c_longjmp: ___c_longjmp,
  /** @export */ __call_sighandler: ___call_sighandler,
  /** @export */ __cpp_exception: ___cpp_exception,
  /** @export */ __heap_base: ___heap_base,
  /** @export */ __indirect_function_table: wasmTable,
  /** @export */ __memory_base: ___memory_base,
  /** @export */ __stack_high: ___stack_high,
  /** @export */ __stack_low: ___stack_low,
  /** @export */ __stack_pointer: ___stack_pointer,
  /** @export */ __syscall__newselect: ___syscall__newselect,
  /** @export */ __syscall_accept4: ___syscall_accept4,
  /** @export */ __syscall_bind: ___syscall_bind,
  /** @export */ __syscall_chdir: ___syscall_chdir,
  /** @export */ __syscall_chmod: ___syscall_chmod,
  /** @export */ __syscall_connect: ___syscall_connect,
  /** @export */ __syscall_faccessat: ___syscall_faccessat,
  /** @export */ __syscall_fchmod: ___syscall_fchmod,
  /** @export */ __syscall_fchown32: ___syscall_fchown32,
  /** @export */ __syscall_fcntl64: ___syscall_fcntl64,
  /** @export */ __syscall_fstat64: ___syscall_fstat64,
  /** @export */ __syscall_ftruncate64: ___syscall_ftruncate64,
  /** @export */ __syscall_getcwd: ___syscall_getcwd,
  /** @export */ __syscall_getdents64: ___syscall_getdents64,
  /** @export */ __syscall_getpeername: ___syscall_getpeername,
  /** @export */ __syscall_getsockname: ___syscall_getsockname,
  /** @export */ __syscall_getsockopt: ___syscall_getsockopt,
  /** @export */ __syscall_ioctl: ___syscall_ioctl,
  /** @export */ __syscall_listen: ___syscall_listen,
  /** @export */ __syscall_lstat64: ___syscall_lstat64,
  /** @export */ __syscall_mkdirat: ___syscall_mkdirat,
  /** @export */ __syscall_newfstatat: ___syscall_newfstatat,
  /** @export */ __syscall_openat: ___syscall_openat,
  /** @export */ __syscall_poll: ___syscall_poll,
  /** @export */ __syscall_readlinkat: ___syscall_readlinkat,
  /** @export */ __syscall_recvfrom: ___syscall_recvfrom,
  /** @export */ __syscall_renameat: ___syscall_renameat,
  /** @export */ __syscall_rmdir: ___syscall_rmdir,
  /** @export */ __syscall_sendto: ___syscall_sendto,
  /** @export */ __syscall_socket: ___syscall_socket,
  /** @export */ __syscall_stat64: ___syscall_stat64,
  /** @export */ __syscall_symlinkat: ___syscall_symlinkat,
  /** @export */ __syscall_unlinkat: ___syscall_unlinkat,
  /** @export */ __syscall_utimensat: ___syscall_utimensat,
  /** @export */ __table_base: ___table_base,
  /** @export */ _abort_js: __abort_js,
  /** @export */ _dlopen_js: __dlopen_js,
  /** @export */ _dlsym_js: __dlsym_js,
  /** @export */ _emscripten_lookup_name: __emscripten_lookup_name,
  /** @export */ _emscripten_runtime_keepalive_clear: __emscripten_runtime_keepalive_clear,
  /** @export */ _gmtime_js: __gmtime_js,
  /** @export */ _localtime_js: __localtime_js,
  /** @export */ _mmap_js: __mmap_js,
  /** @export */ _munmap_js: __munmap_js,
  /** @export */ _tzset_js: __tzset_js,
  /** @export */ clock_time_get: _clock_time_get,
  /** @export */ emscripten_asm_const_double: _emscripten_asm_const_double,
  /** @export */ emscripten_asm_const_int: _emscripten_asm_const_int,
  /** @export */ emscripten_asm_const_ptr: _emscripten_asm_const_ptr,
  /** @export */ emscripten_date_now: _emscripten_date_now,
  /** @export */ emscripten_force_exit: _emscripten_force_exit,
  /** @export */ emscripten_get_device_pixel_ratio: _emscripten_get_device_pixel_ratio,
  /** @export */ emscripten_get_now: _emscripten_get_now,
  /** @export */ emscripten_get_screen_size: _emscripten_get_screen_size,
  /** @export */ emscripten_get_window_title: _emscripten_get_window_title,
  /** @export */ emscripten_is_webgl_context_lost: _emscripten_is_webgl_context_lost,
  /** @export */ emscripten_request_fullscreen: _emscripten_request_fullscreen,
  /** @export */ emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */ emscripten_set_canvas_element_size: _emscripten_set_canvas_element_size,
  /** @export */ emscripten_set_keydown_callback_on_thread: _emscripten_set_keydown_callback_on_thread,
  /** @export */ emscripten_set_keypress_callback_on_thread: _emscripten_set_keypress_callback_on_thread,
  /** @export */ emscripten_set_keyup_callback_on_thread: _emscripten_set_keyup_callback_on_thread,
  /** @export */ emscripten_set_main_loop_arg: _emscripten_set_main_loop_arg,
  /** @export */ emscripten_set_mousedown_callback_on_thread: _emscripten_set_mousedown_callback_on_thread,
  /** @export */ emscripten_set_mouseenter_callback_on_thread: _emscripten_set_mouseenter_callback_on_thread,
  /** @export */ emscripten_set_mouseleave_callback_on_thread: _emscripten_set_mouseleave_callback_on_thread,
  /** @export */ emscripten_set_mousemove_callback_on_thread: _emscripten_set_mousemove_callback_on_thread,
  /** @export */ emscripten_set_mouseup_callback_on_thread: _emscripten_set_mouseup_callback_on_thread,
  /** @export */ emscripten_set_touchcancel_callback_on_thread: _emscripten_set_touchcancel_callback_on_thread,
  /** @export */ emscripten_set_touchend_callback_on_thread: _emscripten_set_touchend_callback_on_thread,
  /** @export */ emscripten_set_touchmove_callback_on_thread: _emscripten_set_touchmove_callback_on_thread,
  /** @export */ emscripten_set_touchstart_callback_on_thread: _emscripten_set_touchstart_callback_on_thread,
  /** @export */ emscripten_set_visibilitychange_callback_on_thread: _emscripten_set_visibilitychange_callback_on_thread,
  /** @export */ emscripten_set_webglcontextlost_callback_on_thread: _emscripten_set_webglcontextlost_callback_on_thread,
  /** @export */ emscripten_set_webglcontextrestored_callback_on_thread: _emscripten_set_webglcontextrestored_callback_on_thread,
  /** @export */ emscripten_set_wheel_callback_on_thread: _emscripten_set_wheel_callback_on_thread,
  /** @export */ emscripten_set_window_title: _emscripten_set_window_title,
  /** @export */ emscripten_webgl_create_context: _emscripten_webgl_create_context,
  /** @export */ emscripten_webgl_make_context_current: _emscripten_webgl_make_context_current,
  /** @export */ environ_get: _environ_get,
  /** @export */ environ_sizes_get: _environ_sizes_get,
  /** @export */ exit: _exit,
  /** @export */ fd_close: _fd_close,
  /** @export */ fd_fdstat_get: _fd_fdstat_get,
  /** @export */ fd_read: _fd_read,
  /** @export */ fd_seek: _fd_seek,
  /** @export */ fd_sync: _fd_sync,
  /** @export */ fd_write: _fd_write,
  /** @export */ getaddrinfo: _getaddrinfo,
  /** @export */ getnameinfo: _getnameinfo,
  /** @export */ glActiveTexture: _glActiveTexture,
  /** @export */ glAttachShader: _glAttachShader,
  /** @export */ glBindAttribLocation: _glBindAttribLocation,
  /** @export */ glBindBuffer: _glBindBuffer,
  /** @export */ glBindFramebuffer: _glBindFramebuffer,
  /** @export */ glBindRenderbuffer: _glBindRenderbuffer,
  /** @export */ glBindTexture: _glBindTexture,
  /** @export */ glBlendFunc: _glBlendFunc,
  /** @export */ glBufferData: _glBufferData,
  /** @export */ glBufferSubData: _glBufferSubData,
  /** @export */ glClear: _glClear,
  /** @export */ glClearColor: _glClearColor,
  /** @export */ glClearDepthf: _glClearDepthf,
  /** @export */ glClearStencil: _glClearStencil,
  /** @export */ glCompileShader: _glCompileShader,
  /** @export */ glCreateProgram: _glCreateProgram,
  /** @export */ glCreateShader: _glCreateShader,
  /** @export */ glCullFace: _glCullFace,
  /** @export */ glDeleteBuffers: _glDeleteBuffers,
  /** @export */ glDeleteFramebuffers: _glDeleteFramebuffers,
  /** @export */ glDeleteProgram: _glDeleteProgram,
  /** @export */ glDeleteRenderbuffers: _glDeleteRenderbuffers,
  /** @export */ glDeleteShader: _glDeleteShader,
  /** @export */ glDeleteTextures: _glDeleteTextures,
  /** @export */ glDepthFunc: _glDepthFunc,
  /** @export */ glDepthMask: _glDepthMask,
  /** @export */ glDetachShader: _glDetachShader,
  /** @export */ glDisable: _glDisable,
  /** @export */ glDisableVertexAttribArray: _glDisableVertexAttribArray,
  /** @export */ glDrawArrays: _glDrawArrays,
  /** @export */ glDrawArraysInstanced: _glDrawArraysInstanced,
  /** @export */ glDrawElements: _glDrawElements,
  /** @export */ glDrawElementsInstanced: _glDrawElementsInstanced,
  /** @export */ glEnable: _glEnable,
  /** @export */ glEnableVertexAttribArray: _glEnableVertexAttribArray,
  /** @export */ glFramebufferRenderbuffer: _glFramebufferRenderbuffer,
  /** @export */ glFramebufferTexture2D: _glFramebufferTexture2D,
  /** @export */ glGenBuffers: _glGenBuffers,
  /** @export */ glGenFramebuffers: _glGenFramebuffers,
  /** @export */ glGenRenderbuffers: _glGenRenderbuffers,
  /** @export */ glGenTextures: _glGenTextures,
  /** @export */ glGenerateMipmap: _glGenerateMipmap,
  /** @export */ glGetAttribLocation: _glGetAttribLocation,
  /** @export */ glGetBooleanv: _glGetBooleanv,
  /** @export */ glGetIntegerv: _glGetIntegerv,
  /** @export */ glGetProgramInfoLog: _glGetProgramInfoLog,
  /** @export */ glGetProgramiv: _glGetProgramiv,
  /** @export */ glGetShaderInfoLog: _glGetShaderInfoLog,
  /** @export */ glGetShaderPrecisionFormat: _glGetShaderPrecisionFormat,
  /** @export */ glGetShaderiv: _glGetShaderiv,
  /** @export */ glGetString: _glGetString,
  /** @export */ glGetUniformLocation: _glGetUniformLocation,
  /** @export */ glIsProgram: _glIsProgram,
  /** @export */ glIsRenderbuffer: _glIsRenderbuffer,
  /** @export */ glIsShader: _glIsShader,
  /** @export */ glLinkProgram: _glLinkProgram,
  /** @export */ glPixelStorei: _glPixelStorei,
  /** @export */ glReadPixels: _glReadPixels,
  /** @export */ glRenderbufferStorage: _glRenderbufferStorage,
  /** @export */ glScissor: _glScissor,
  /** @export */ glShaderSource: _glShaderSource,
  /** @export */ glStencilFunc: _glStencilFunc,
  /** @export */ glStencilMask: _glStencilMask,
  /** @export */ glStencilOp: _glStencilOp,
  /** @export */ glTexImage2D: _glTexImage2D,
  /** @export */ glTexParameteri: _glTexParameteri,
  /** @export */ glUniform1fv: _glUniform1fv,
  /** @export */ glUniform1i: _glUniform1i,
  /** @export */ glUniform1iv: _glUniform1iv,
  /** @export */ glUniform2fv: _glUniform2fv,
  /** @export */ glUniform3fv: _glUniform3fv,
  /** @export */ glUniform4fv: _glUniform4fv,
  /** @export */ glUniformMatrix4fv: _glUniformMatrix4fv,
  /** @export */ glUseProgram: _glUseProgram,
  /** @export */ glVertexAttribDivisor: _glVertexAttribDivisor,
  /** @export */ glVertexAttribPointer: _glVertexAttribPointer,
  /** @export */ glViewport: _glViewport,
  /** @export */ memory: wasmMemory,
  /** @export */ proc_exit: _proc_exit,
  /** @export */ webxr_get_input_pose: _webxr_get_input_pose,
  /** @export */ webxr_get_input_sources: _webxr_get_input_sources,
  /** @export */ webxr_init: _webxr_init,
  /** @export */ webxr_request_exit: _webxr_request_exit,
  /** @export */ webxr_request_session: _webxr_request_session,
  /** @export */ webxr_set_select_callback: _webxr_set_select_callback,
  /** @export */ webxr_set_select_end_callback: _webxr_set_select_end_callback,
  /** @export */ webxr_set_select_start_callback: _webxr_set_select_start_callback
};

// Argument name here must shadow the `wasmExports` global so
// that it is recognised by metadce and minify-import-export-names
// passes.
function applySignatureConversions(wasmExports) {
  // First, make a copy of the incoming exports object
  wasmExports = Object.assign({}, wasmExports);
  var makeWrapper_p = f => () => f() >>> 0;
  var makeWrapper_ppppp = f => (a0, a1, a2, a3) => f(a0, a1, a2, a3) >>> 0;
  var makeWrapper_p_ = f => a0 => f(a0) >>> 0;
  var makeWrapper_pp = f => a0 => f(a0) >>> 0;
  var makeWrapper_ppp = f => (a0, a1) => f(a0, a1) >>> 0;
  wasmExports["__errno_location"] = makeWrapper_p(wasmExports["__errno_location"]);
  wasmExports["_emscripten_find_dylib"] = makeWrapper_ppppp(wasmExports["_emscripten_find_dylib"]);
  wasmExports["strerror"] = makeWrapper_p_(wasmExports["strerror"]);
  wasmExports["malloc"] = makeWrapper_pp(wasmExports["malloc"]);
  wasmExports["calloc"] = makeWrapper_ppp(wasmExports["calloc"]);
  wasmExports["realloc"] = makeWrapper_ppp(wasmExports["realloc"]);
  wasmExports["emscripten_builtin_memalign"] = makeWrapper_ppp(wasmExports["emscripten_builtin_memalign"]);
  wasmExports["_emscripten_stack_alloc"] = makeWrapper_pp(wasmExports["_emscripten_stack_alloc"]);
  wasmExports["emscripten_stack_get_current"] = makeWrapper_p(wasmExports["emscripten_stack_get_current"]);
  return wasmExports;
}

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===
function callMain(args = []) {
  var entryFunction = resolveGlobalSymbol("main").sym;
  // Main modules can't tell if they have main() at compile time, since it may
  // arrive from a dynamic library.
  if (!entryFunction) return;
  args.unshift(thisProgram);
  var argc = args.length;
  var argv = stackAlloc((argc + 1) * 4);
  var argv_ptr = argv;
  args.forEach(arg => {
    HEAPU32[((argv_ptr) >>> 2) >>> 0] = stringToUTF8OnStack(arg);
    argv_ptr += 4;
  });
  HEAPU32[((argv_ptr) >>> 2) >>> 0] = 0;
  try {
    var ret = entryFunction(argc, argv);
    // if we're not running an evented main loop, it's time to exit
    exitJS(ret, /* implicit = */ true);
    return ret;
  } catch (e) {
    return handleException(e);
  }
}

function run(args = arguments_) {
  if (runDependencies > 0) {
    dependenciesFulfilled = run;
    return;
  }
  preRun();
  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    dependenciesFulfilled = run;
    return;
  }
  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    Module["calledRun"] = true;
    if (ABORT) return;
    initRuntime();
    preMain();
    Module["onRuntimeInitialized"]?.();
    var noInitialRun = Module["noInitialRun"] || false;
    if (!noInitialRun) callMain(args);
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(() => {
      setTimeout(() => Module["setStatus"](""), 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}

var wasmExports;

// With async instantation wasmExports is assigned asynchronously when the
// instance is received.
createWasm();

run();
