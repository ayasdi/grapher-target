(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var Grapher = require('ayasdi-grapher');
require('../target.js')(Grapher);

window.Grapher = Grapher;

},{"../target.js":3,"ayasdi-grapher":2}],2:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Grapher = factory());
}(this, (function () { 'use strict';

  var linkVert = "uniform vec2 u_resolution;\nattribute vec2 a_position;\nattribute vec4 a_rgba;\nvarying vec4 rgba;\nvoid main() {\n  vec2 clipspace = a_position / u_resolution * 2.0 - 1.0;\n  gl_Position = vec4(clipspace * vec2(1, -1), 0, 1);\n  rgba = a_rgba / 255.0;\n}";

  var linkFrag = "precision mediump float;\nvarying vec4 rgba;\nvoid main() {\n  gl_FragColor = rgba;\n}\n";

  var nodeVert = "uniform vec2 u_resolution;\nattribute vec2 a_position;\nattribute vec4 a_rgba;\nattribute vec2 a_center;\nattribute float a_radius;\nvarying vec4 rgba;\nvarying vec2 center;\nvarying vec2 resolution;\nvarying float radius;\nvoid main() {\n  vec2 clipspace = a_position / u_resolution * 2.0 - 1.0;\n  gl_Position = vec4(clipspace * vec2(1, -1), 0, 1);\n  rgba = a_rgba / 255.0;\n  radius = a_radius;\n  center = a_center;\n  resolution = u_resolution;\n}";

  var nodeFrag = "precision mediump float;\nvarying vec4 rgba;\nvarying vec2 center;\nvarying vec2 resolution;\nvarying float radius;\nvoid main() {\n  vec4 color0 = vec4(0.0, 0.0, 0.0, 0.0);\n  float x = gl_FragCoord.x;\n  float y = resolution[1] - gl_FragCoord.y;\n  float dx = center[0] - x;\n  float dy = center[1] - y;\n  float distance = sqrt(dx * dx + dy * dy);\n  float diff = distance - radius;\n  if ( diff < 0.0 )\n    gl_FragColor = rgba;\n  else if ( diff >= 0.0 && diff <= 1.0 )\n    gl_FragColor = vec4(rgba.r, rgba.g, rgba.b, rgba.a - diff);\n  else \n    gl_FragColor = color0;\n}";

  var Renderer = (function () {
    var Renderer = function () {
      if ( !initializing && this.init )
        this.init.apply(this, arguments);
      return this;
    };

    Renderer.prototype = {
      init: function (o) {
        this.canvas = o.canvas;
        this.lineWidth = o.lineWidth || 2;
        this.resolution = o.resolution || 1;
        this.setScale(o.scale);
        this.setTranslate(o.translate);
        this.setNodeScale(o.nodeScale);

        this.resize();
      },
      setNodes: function (nodes) { this.nodeObjects = nodes; },
      setLinks: function (links) { this.linkObjects = links; },
      setNodeScale: function (scale) {
        this.nodeScale = scale;
      },
      setScale: function (scale) {
        if (!Array.isArray(scale)) scale = [scale, scale];
        this.scale = scale;
      },
      setTranslate: function (translate) { this.translate = translate; },
      transformX: function (x) { return x * this.scale[0] + this.translate[0]; },
      transformY: function (y) { return y * this.scale[1] + this.translate[1]; },
      untransformX: function (x) { return (x - this.translate[0]) / this.scale[0]; },
      untransformY: function (y) { return (y - this.translate[1]) / this.scale[1]; },
      resize: function (width, height) {
        var displayWidth  = (width || this.canvas.clientWidth) * this.resolution;
        var displayHeight = (height || this.canvas.clientHeight) * this.resolution;

        if (this.canvas.width != displayWidth) this.canvas.width  = displayWidth;
        if (this.canvas.height != displayHeight) this.canvas.height = displayHeight;
      }
    };

    var initializing = false;

    Renderer.extend = function (prop) {
      var _super = this.prototype;

      initializing = true;
      var prototype = new this();
      initializing = false;

      prototype._super = this.prototype;
      for (var name in prop) {
        prototype[name] = typeof prop[name] == "function" &&
          typeof _super[name] == "function" && /\b_super\b/.test(prop[name]) ?
          (function(name, fn){
            return function() {
              var tmp = this._super;
             
              // Add a new ._super() method that is the same method
              // but on the super-class
              this._super = _super[name];
             
              // The method only need to be bound temporarily, so we
              // remove it when we're done executing
              var ret = fn.apply(this, arguments);
              this._super = tmp;
             
              return ret;
            };
          })(name, prop[name]) :
          prop[name];
      }

      // The dummy class constructor
      function Renderer () {
        // All construction is actually done in the init method
        if ( !initializing && this.init )
          this.init.apply(this, arguments);
      }
     
      // Populate our constructed prototype object
      Renderer.prototype = prototype;

      // Enforce the constructor to be what we expect
      Renderer.prototype.constructor = Renderer;

      return Renderer;
    };

    return Renderer;
  })();

  var WebGLRenderer = Renderer.extend({
    init: function (o) {
      this.gl = o.webGL;

      this.linkVertexShader   = o.linkShaders && o.linkShaders.vertexCode   || linkVert;
      this.linkFragmentShader = o.linkShaders && o.linkShaders.fragmentCode || linkFrag;
      this.nodeVertexShader   = o.nodeShaders && o.nodeShaders.vertexCode   || nodeVert;
      this.nodeFragmentShader = o.nodeShaders && o.nodeShaders.fragmentCode || nodeFrag;

      this._super(o);
      this.initGL();

      this.NODE_ATTRIBUTES = 9;
      this.LINK_ATTRIBUTES = 6;
    },

    initGL: function (gl) {
      if (gl) this.gl = gl;

      this.linksProgram = this.initShaders(this.linkVertexShader, this.linkFragmentShader);
      this.nodesProgram = this.initShaders(this.nodeVertexShader, this.nodeFragmentShader);

      this.gl.linkProgram(this.linksProgram);
      this.gl.linkProgram(this.nodesProgram);

      this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
      this.gl.enable(this.gl.BLEND);
    },

    initShaders: function (vertexShaderSource, fragmentShaderSource) {
      var vertexShader = this.getShaders(this.gl.VERTEX_SHADER, vertexShaderSource);
      var fragmentShader = this.getShaders(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
      var shaderProgram = this.gl.createProgram();
      this.gl.attachShader(shaderProgram, vertexShader);
      this.gl.attachShader(shaderProgram, fragmentShader);
      return shaderProgram;
    },

    getShaders: function (type, source) {
      var shader = this.gl.createShader(type);
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      return shader;
    },

    updateNodesBuffer: function () {
      var j = 0;
      this.nodes = [];
      for (var i = 0; i < this.nodeObjects.length; i++) {
        var node = this.nodeObjects[i];
        var cx = this.transformX(node.x) * this.resolution;
        var cy = this.transformY(node.y) * this.resolution;
        var r = node.r * this.nodeScale * this.resolution + 1;
        // adding few px to keep shader area big enough for antialiasing pixesls
        var shaderSize = r + 10;

        this.nodes[j++] = (cx - shaderSize);
        this.nodes[j++] = (cy - shaderSize);
        this.nodes[j++] = node.color[0];
        this.nodes[j++] = node.color[1];
        this.nodes[j++] = node.color[2];
        this.nodes[j++] = node.color[3];
        this.nodes[j++] = cx;
        this.nodes[j++] = cy;
        this.nodes[j++] = r;

        this.nodes[j++] = (cx + (1 + Math.sqrt(2)) * shaderSize);
        this.nodes[j++] = cy - shaderSize;
        this.nodes[j++] = node.color[0];
        this.nodes[j++] = node.color[1];
        this.nodes[j++] = node.color[2];
        this.nodes[j++] = node.color[3];
        this.nodes[j++] = cx;
        this.nodes[j++] = cy;
        this.nodes[j++] = r;

        this.nodes[j++] = (cx - shaderSize);
        this.nodes[j++] = (cy + (1 + Math.sqrt(2)) * shaderSize);
        this.nodes[j++] = node.color[0];
        this.nodes[j++] = node.color[1];
        this.nodes[j++] = node.color[2];
        this.nodes[j++] = node.color[3];
        this.nodes[j++] = cx;
        this.nodes[j++] = cy;
        this.nodes[j++] = r;
      }
    },

    updateLinksBuffer: function () {
      var j = 0;
      this.links = [];
      for (var i = 0; i < this.linkObjects.length; i++) {
        var link = this.linkObjects[i];
        var x1 = this.transformX(link.x1) * this.resolution;
        var y1 = this.transformY(link.y1) * this.resolution;
        var x2 = this.transformX(link.x2) * this.resolution;
        var y2 = this.transformY(link.y2) * this.resolution;

        this.links[j++] = x1;
        this.links[j++] = y1;
        this.links[j++] = link.color[0];
        this.links[j++] = link.color[1];
        this.links[j++] = link.color[2];
        this.links[j++] = link.color[3];

        this.links[j++] = x2;
        this.links[j++] = y2;
        this.links[j++] = link.color[0];
        this.links[j++] = link.color[1];
        this.links[j++] = link.color[2];
        this.links[j++] = link.color[3];
      }
    },

    resize: function (width, height) {
      this._super(width, height);
      this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    },

    render: function () {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      this.resize();
      this.updateNodesBuffer();
      this.updateLinksBuffer();
      // links have to be rendered first because of blending;
      if (this.links.length) this.renderLinks();
      this.renderNodes();
    },

    renderLinks: function () {
      var program = this.linksProgram;
      this.gl.useProgram(program);

      var linksBuffer = new Float32Array(this.links);
      var buffer = this.gl.createBuffer();

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, linksBuffer, this.gl.STATIC_DRAW);

      var resolutionLocation = this.gl.getUniformLocation(program, 'u_resolution');
      this.gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);

      var positionLocation = this.gl.getAttribLocation(program, 'a_position');
      var rgbaLocation = this.gl.getAttribLocation(program, 'a_rgba');

      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.enableVertexAttribArray(rgbaLocation);

      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, this.LINK_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 0);
      this.gl.vertexAttribPointer(rgbaLocation, 4, this.gl.FLOAT, false, this.LINK_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 8);

      var lineWidthRange = this.gl.getParameter(this.gl.ALIASED_LINE_WIDTH_RANGE); // ex [1,10]
      var lineWidth = this.lineWidth * this.resolution;
      var lineWidthInRange = Math.min(Math.max(lineWidth, lineWidthRange[0]), lineWidthRange[1]);

      this.gl.lineWidth(lineWidthInRange);
      this.gl.drawArrays(this.gl.LINES, 0, this.links.length/this.LINK_ATTRIBUTES);
    },

    renderNodes: function () {
      var program = this.nodesProgram;
      this.gl.useProgram(program);

      var nodesBuffer = new Float32Array(this.nodes);
      var buffer = this.gl.createBuffer();

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, nodesBuffer, this.gl.STATIC_DRAW);

      var resolutionLocation = this.gl.getUniformLocation(program, 'u_resolution');
      this.gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);

      var positionLocation = this.gl.getAttribLocation(program, 'a_position');
      var rgbaLocation = this.gl.getAttribLocation(program, 'a_rgba');
      var centerLocation = this.gl.getAttribLocation(program, 'a_center');
      var radiusLocation = this.gl.getAttribLocation(program, 'a_radius');

      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.enableVertexAttribArray(rgbaLocation);
      this.gl.enableVertexAttribArray(centerLocation);
      this.gl.enableVertexAttribArray(radiusLocation);

      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, this.NODE_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 0);
      this.gl.vertexAttribPointer(rgbaLocation, 4, this.gl.FLOAT, false, this.NODE_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 8);
      this.gl.vertexAttribPointer(centerLocation, 2, this.gl.FLOAT, false, this.NODE_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 24);
      this.gl.vertexAttribPointer(radiusLocation, 1, this.gl.FLOAT, false, this.NODE_ATTRIBUTES  * Float32Array.BYTES_PER_ELEMENT, 32);

      this.gl.drawArrays(this.gl.TRIANGLES, 0, this.nodes.length/this.NODE_ATTRIBUTES);
    }
  });

  var CanvasRenderer = Renderer.extend({
    init: function (o) {
      this._super(o);
      this.context = this.canvas.getContext('2d');
    },

    render: function () {
      this.resize();
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.renderLinks();
      this.renderNodes();
    },

    renderNodes: function () {
      for (var i = 0 ; i < this.nodeObjects.length; i ++) {
        var node = this.nodeObjects[i];
        var cx = this.transformX(node.x) * this.resolution;
        var cy = this.transformY(node.y) * this.resolution;
        var r = node.r * this.nodeScale * this.resolution;

        this.context.beginPath();
        this.context.arc(cx, cy, r, 0, 2 * Math.PI, false);
        this.context.fillStyle = 'rgba(' + node.color.join(',') + ')';
        this.context.fill();
      }
    },

    renderLinks: function () {
      for (var i = 0 ; i < this.linkObjects.length; i ++) {
        var link = this.linkObjects[i];
        var x1 = this.transformX(link.x1) * this.resolution;
        var y1 = this.transformY(link.y1) * this.resolution;
        var x2 = this.transformX(link.x2) * this.resolution;
        var y2 = this.transformY(link.y2) * this.resolution;

        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.lineWidth = this.lineWidth * this.resolution;
        this.context.strokeStyle = 'rgba(' + link.color.join(',') + ')';
        this.context.stroke();
      }
    }
  });

  // Ayasdi Inc. Copyright 2014
  // Color.js may be freely distributed under the Apache 2.0 license

  /**
    * Color.js
    * ========
    * Color helper.
    *
    * Colors parsed by this helper will be in the format:
    * [r, g, b, a]
    * where each color attribute is a value between 0-255.
    */

  var Color = {
    interpolate: interpolate,
    parse: parse
  };

  function interpolate (a, b, amt) {
    amt = amt === undefined ? 0.5 : amt;
    var interpolated = a.map(function (colorA, index) {
      var colorB = b[index];
      return colorA + (colorB - colorA) * amt;
    });
    return interpolated;
  }

  function parse (c) {
    var color;
    if (typeof c === 'string') {
      var string = c.replace(/ /g, ''); // strip spaces immediately

      if (c.split('#').length > 1) color = parseHex(string);
      else if (c.split('rgb(').length > 1) color = parseRgb(string);
      else if (c.split('rgba(').length > 1) color = parseRgba(string);
    } else if (typeof c === 'number') {
      color = parseColorInteger(parseInt(c, 10));
    }
    return color;
  }

  function parseColorInteger (intColor) {
    return [
      Math.floor(intColor / Math.pow(2, 16)) % Math.pow(2, 8),
      Math.floor(intColor / Math.pow(2, 8)) % Math.pow(2, 8),
      intColor % Math.pow(2, 8),
      Math.floor(intColor / Math.pow(2, 24)) % Math.pow(2, 8)
    ];
  }

  function parseHex (string) {
    var hex = string.replace('#', '');
    if (hex.length === 6) hex = 'ff' + hex; // prepend full alpha if needed
    return parseColorInteger(parseInt(hex, 16));
  }

  function parseRgb (string) {
    var rgba = string.substring(4, string.length - 1).split(',').map(function (c) {
      return parseInt(c, 10);
    });
    rgba[3] = 255; // full alpha
    return rgba;
  }

  function parseRgba (string) {
    var rgba = string.substring(5, string.length - 1).split(',').map(function (c) {
      return parseFloat(c, 10);
    });
    // Assume that if the given alpha is 0-1, it's normalized.
    rgba[3] = rgba[3] <= 1 ? 255 * rgba[3] : rgba[3];
    return rgba;
  }

  function Link () {
    this.x1 = 0;
    this.y1 = 0;
    this.x2 = 0;
    this.y2 = 0;
    this.color = null;
    return this;
  }

  Link.prototype.update = function (x1, y1, x2, y2, color) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.color = color;
    return this;
  };

  function Node () {
    this.x = 0;
    this.y = 0;
    this.r = 10;
    this.color = null;
    return this;
  }

  Node.prototype.update = function (x, y, r, color) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.color = color;
    return this;
  };

  var Shaders = (function () {
    function Shaders (obj) {
      this.vertexCode = obj && obj.vertexCode || null;
      this.fragmentCode = obj && obj.fragmentCode || null;
      return this;
    }

    Shaders.prototype.addVertexAttr = function (name, value, size, type, normalized) {
      var attrs = {
        name: name,
        value: value,
        size: size,
        type: type,
        normalized: normalized
      };

      this.vertexAttrs.push(attrs);
    };

    Shaders.prototype.addUniformAttr = function (name, value) {
      var attrs = {
        name: name,
        value: value
      };

      this.uniformAttrs.push(attrs);
    };

    return Shaders;
  })();

  /**
   * Utilities
   * =========
   *
   * Various utility functions
   */
  var Utilities = {
    each: each,
    eachPop: eachPop,
    eachKey: eachKey,
    map: map,
    clean: clean,
    range: range,
    sortedIndex: sortedIndex,
    indexOf: indexOf,
    uniqueInsert: uniqueInsert,
    extend: extend,
    bind: bind,
    noop: noop,
    isUndefined: isUndefined,
    isFunction: isFunction,
    isObject: isObject,
    isArray: Array.isArray,
    isNumber: isNumber,
    isNaN: isNaN
  };

  /**
   * noop
   * -----
   *
   * A function that does nothing.
   */
  function noop () {}

  /**
   * each
   * -----
   *
   * Perform an operation on each element in an array.
   *
   *     var arr = [1, 2, 3];
   *     u.each(arr, fn);
   */
  function each (arr, fn, ctx) {
    fn = bind(fn, ctx);
    var i = arr.length;
    while (--i > -1) {
      fn(arr[i], i);
    }
    return arr;
  }

  /**
   * eachPop
   * -------
   *
   * Perform a function on each element in an array. Faster than each, but won't pass index and the
   * array will be cleared.
   *
   *     u.eachPop([1, 2, 3], fn);
   */
  function eachPop (arr, fn, ctx) {
    fn = bind(fn, ctx);
    while (arr.length) {
      fn(arr.pop());
    }
    return arr;
  }

  /**
   * eachKey
   * -------
   *
   * Perform a function on each property in an object.
   *
   *     var obj = {foo: 0, bar: 0};
   *     u.eachKey(obj, fn);
   */
  function eachKey (obj, fn, ctx) {
    fn = bind(fn, ctx);
    if (isObject(obj)) {
      var keys = Object.keys(obj);

      while (keys.length) {
        var key = keys.pop();
        fn(obj[key], key);
      }
    }
    return obj;
  }

  /**
   * map
   * -----
   *
   * Get a new array with values calculated from original array.
   *
   *     var arr = [1, 2, 3];
   *     var newArr = u.map(arr, fn);
   */
  function map (arr, fn, ctx) {
    fn = bind(fn, ctx);
    var i = arr.length,
        mapped = new Array(i);
    while (--i > -1) {
      mapped[i] = fn(arr[i], i);
    }
    return mapped;
  }

  /**
   * clean
   * -----
   *
   * Clean an array by reference.
   *
   *     var arr = [1, 2, 3];
   *     u.clean(arr); // arr = []
   */
  function clean (arr) {
    eachPop(arr, noop);
    return arr;
  }

  /**
   * range
   * -----
   *
   * Create an array of numbers from start to end, incremented by step.
   */
  function range (start, end, step) {
    step = isNumber(step) ? step : 1;
    if (isUndefined(end)) {
      end = start;
      start = 0;
    }

    var i = Math.max(Math.ceil((end - start) / step), 0),
        result = new Array(i);

    while (--i > -1) {
      result[i] = start + (step * i);
    }
    return result;
  }

  /**
   * sortedIndex
   * -----------
   *
   * Finds the sorted position of a number in an Array of numbers.
   */
  function sortedIndex (arr, n) {
    var min = 0,
        max = arr.length;

    while (min < max) {
      var mid = min + max >>> 1;
      if (n < arr[mid]) max = mid;
      else min = mid + 1;
    }

    return min;
  }

  /**
   * indexOf
   * -------
   *
   * Finds the index of a variable in an array.
   * Returns -1 if not found.
   */
  function indexOf (arr, n) {
    var i = arr.length;
    while (--i > -1) {
      if (arr[i] === n) return i;
    }
    return i;
  }

  /**
   * uniqueInsert
   * ------------
   *
   * Inserts a value into an array only if it does not already exist
   * in the array.
   */
  function uniqueInsert (arr, n) {
    if (indexOf(arr, n) === -1) arr.push(n);
    return arr;
  }

  /**
   * extend
   * ------
   *
   * Extend an object with the properties of one other objects
   */
  function extend (obj, source) {
    if (isObject(obj) && isObject(source)) {
      var props = Object.getOwnPropertyNames(source),
        i = props.length;
      while (--i > -1) {
        var prop = props[i];
        obj[prop] = source[prop];
      }
    }
    return obj;
  }

  /**
     * bind
     * ----
     *
     * Bind a function to a context. Optionally pass in the number of arguments
     * which will use the faster fn.call if the number of arguments is 0, 1, or 2.
     */
  function bind (fn, ctx) {
    if (!ctx) return fn;
    return function () { return fn.apply(ctx, arguments); };
  }

  /**
   * isUndefined
   * -----------
   *
   * Checks if a variable is undefined.
   */
  function isUndefined (o) {
    return typeof o === 'undefined';
  }

  /**
   * isFunction
   * ----------
   *
   * Checks if a variable is a function.
   */
  function isFunction (o) {
    return typeof o === 'function';
  }

  /**
   * isObject
   * --------
   *
   * Checks if a variable is an object.
   */
  function isObject (o) {
    return typeof o === 'object' && !!o;
  }

  /**
   * isNumber
   * --------
   *
   * Checks if a variable is a number.
   */
  function isNumber (o) {
    return typeof o === 'number';
  }

  /**
   * isNaN
   * -----
   *
   * Checks if a variable is NaN.
   */
  function isNaN (o) {
    return isNumber(o) && o !== +o;
  }

  // Ayasdi Inc. Copyright 2014
  // Grapher.js may be freely distributed under the Apache 2.0 license

  /**
    * Grapher
    * =======
    * WebGL network grapher rendering.
    */
  function Grapher () {
    this.initialize.apply(this, arguments);
    return this;
  }

  /**
    * Helpers and Renderers
    * =====================
    * Load helpers and renderers.
    */
  Grapher.WebGLRenderer = WebGLRenderer;
  Grapher.CanvasRenderer = CanvasRenderer;
  Grapher.Color = Color;
  Grapher.Link = Link;
  Grapher.Node = Node;
  Grapher.Shaders = Shaders;
  Grapher.utils = Utilities;

  /**
    * Grapher Static Properties
    * =========================
    */
  var NODES = Grapher.NODES = 'nodes';
  var LINKS = Grapher.LINKS = 'links';

  /**
    * Grapher Prototype
    * =================
    */

  Grapher.prototype = {};

  /**
    * grapher.initialize
    * ------------------
    *
    * Initialize is called when a grapher instance is created:
    *
    *     var grapher = new Grapher(width, height, options);
    *
    */
  Grapher.prototype.initialize = function (o) {
    if (!o) o = {};

    // Extend default properties with options
    this.props = Utilities.extend({
      color: Color.parse('#222222'),
      scale: 1,
      nodeScale: 1,
      translate: [0, 0],
      resolution: window.devicePixelRatio || 1
    }, o);

    if (!o.canvas) this.props.canvas = document.createElement('canvas');
    this.canvas = this.props.canvas;

    var webGL = this._getWebGL();
    if (webGL) {
      this.props.webGL = webGL;
      this.props.canvas.addEventListener('webglcontextlost', function (e) { this._onContextLost(e); }.bind(this));
      this.props.canvas.addEventListener('webglcontextrestored', function (e) { this._onContextRestored(e); }.bind(this));
      this.props.linkShaders = new Shaders(this.props.linkShaders);
      this.props.nodeShaders = new Shaders(this.props.nodeShaders);
    }

    // Renderer and view
    this.renderer =  webGL ? new WebGLRenderer(this.props) : new CanvasRenderer(this.props);
    this.rendered = false;

    // Sprite array
    this.links = [];
    this.nodes = [];

    this.renderer.setLinks(this.links);
    this.renderer.setNodes(this.nodes);

    // Indices that will update
    this.willUpdate = {};
    this.updateAll = {};
    this._clearUpdateQueue();

    // Bind some updaters
    this._updateLink = Utilities.bind(this._updateLink, this);
    this._updateNode = Utilities.bind(this._updateNode, this);
    this._updateLinkByIndex = Utilities.bind(this._updateLinkByIndex, this);
    this._updateNodeByIndex = Utilities.bind(this._updateNodeByIndex, this);
    this.animate = Utilities.bind(this.animate, this);

    // Event Handlers
    this.handlers = {};

    // Do any additional setup
    Utilities.eachKey(o, this.set, this);
  };

  /**
    * grapher.set
    * ------------------
    *
    * General setter for a grapher's properties.
    *
    *     grapher.set(1, 'scale');
    */
  Grapher.prototype.set = function (val, key) {
    var setter = this[key];
    if (setter && Utilities.isFunction(setter))
      return setter.call(this, val);
  };

  /**
    * grapher.on
    * ------------------
    *
    * Add a listener to a grapher event. Only one listener can be bound to an
    * event at this time. Available events:
    *
    *   * mousedown
    *   * mouseover
    *   * mouseup
    */
  Grapher.prototype.on = function (event, fn) {
    this.handlers[event] = this.handlers[event] || [];
    this.handlers[event].push(fn);
    this.canvas.addEventListener(event, fn, false);
    return this;
  };

  /**
    * grapher.off
    * ------------------
    *
    * Remove a listener from an event, or all listeners from an event if fn is not specified.
    */
  Grapher.prototype.off = function (event, fn) {
    var removeHandler = Utilities.bind(function (fn) {
      var i = Utilities.indexOf(this.handlers[event], fn);
      if (i > -1) this.handlers[event].splice(i, 1);
      this.canvas.removeEventListener(event, fn, false);
    }, this);

    if (fn && this.handlers[event]) removeHandler(fn);
    else if (Utilities.isUndefined(fn) && this.handlers[event]) Utilities.each(this.handlers[event], removeHandler);

    return this;
  };

  /**
    * grapher.data
    * ------------------
    *
    * Accepts network data in the form:
    *
    *     {
    *       nodes: [{x: 0, y: 0, r: 20, color: (swatch or hex/rgb)}, ... ],
    *       links: [{from: 0, to: 1, color: (swatch or hex/rgb)}, ... ]
    *     }
    */
  Grapher.prototype.data = function (data) {
    if (Utilities.isUndefined(data)) return this.props.data;

    this.props.data = data;
    this.exit();
    this.enter();
    this.update();

    return this;
  };

  /**
    * grapher.enter
    * ------------------
    *
    * Creates node and link sprites to match the number of nodes and links in the
    * data.
    */
  Grapher.prototype.enter = function () {
    var data = this.data();
    if (this.links.length < data.links.length) {
      var links = data.links.slice(this.links.length, data.links.length);
      Utilities.eachPop(links, Utilities.bind(function () { this.links.push(new Link()); }, this));
    }

    if (this.nodes.length < data.nodes.length) {
      var nodes = data.nodes.slice(this.nodes.length, data.nodes.length);
      Utilities.eachPop(nodes, Utilities.bind(function () { this.nodes.push(new Node()); }, this));
    }

    return this;
  };

  /**
    * grapher.exit
    * ------------------
    *
    * Removes node and link sprites to match the number of nodes and links in the
    * data.
    */
  Grapher.prototype.exit = function () {
    var data = this.data();

    if (data.links.length < this.links.length) {
      this.links.splice(data.links.length, this.links.length - data.links.length);
    }
    if (data.nodes.length < this.nodes.length) {
      this.nodes.splice(data.nodes.length, this.nodes.length - data.nodes.length);
    }

    return this;
  };

  /**
    * grapher.update
    * ------------------
    *
    * Add nodes and/or links to the update queue by index. Passing in no arguments will
    * add all nodes and links to the update queue. Node and link sprites in the update
    * queue are updated at the time of rendering.
    *
    *     grapher.update(); // updates all nodes and links
    *     grapher.update('links'); // updates only links
    *     grapher.update('nodes', 0, 4); // updates nodes indices 0 to 3 (4 is not inclusive)
    *     grapher.update('links', [0, 1, 2, 6, 32]); // updates links indexed by the indices
    */
  Grapher.prototype.update = function (type, start, end) {
    var indices;
    if (Utilities.isArray(start)) indices = start;
    else if (Utilities.isNumber(start) && Utilities.isNumber(end)) indices = Utilities.range(start, end);

    if (Utilities.isArray(indices)) {
      this._addToUpdateQueue(type, indices);
      if (type === NODES) this._addToUpdateQueue(LINKS, this._findLinks(indices));
    } else {
      if (type !== NODES) this.updateAll.links = true;
      if (type !== LINKS) this.updateAll.nodes = true;
    }
    return this;
  };

  /**
    * grapher.updateNode
    * ------------------
    *
    * Add an individual node to the update queue. Optionally pass in a boolean to
    * specify whether or not to also add links connected with the node to the update queue.
    */
  Grapher.prototype.updateNode = function (index, willUpdateLinks) {
    this._addToUpdateQueue(NODES, [index]);
    if (willUpdateLinks) this._addToUpdateQueue(LINKS, this._findLinks([index]));
    return this;
  };

  /**
    * grapher.updateLink
    * ------------------
    *
    * Add an individual link to the update queue.
    */
  Grapher.prototype.updateLink = function (index) {
    this._addToUpdateQueue(LINKS, [index]);
    return this;
  };

  /**
    * grapher.clear
    * ------------------
    *
    * Clears the canvas and grapher data.
    */
  Grapher.prototype.clear = function () {
    this.data({links: [], nodes: []});
    this.render();
    return this;
  };

  /**
    * grapher.render
    * ------------------
    *
    * Updates each sprite and renders the network.
    */
  Grapher.prototype.render = function () {
    this.rendered = true;
    this._update();
    this.renderer.render();
    return this;
  };

  /**
    * grapher.animate
    * ------------------
    *
    * Calls render in a requestAnimationFrame loop.
    */
  Grapher.prototype.animate = function () {
    this.render();
    this.currentFrame = requestAnimationFrame(this.animate);
  };

  /**
    * grapher.play
    * ------------------
    *
    * Starts the animate loop.
    */
  Grapher.prototype.play = function () {
    this.currentFrame = requestAnimationFrame(this.animate);
    return this;
  };

  /**
    * grapher.pause
    * ------------------
    *
    * Pauses the animate loop.
    */
  Grapher.prototype.pause = function () {
    if (this.currentFrame) cancelAnimationFrame(this.currentFrame);
    this.currentFrame = null;
    return this;
  };

  /**
    * grapher.resize
    * ------------------
    *
    * Resize the grapher view.
    */
  Grapher.prototype.resize = function (width, height) {
    this.renderer.resize(width, height);
    return this;
  };

  /**
    * grapher.width
    * ------------------
    *
    * Specify or retrieve the width.
    */
  Grapher.prototype.width = function (width) {
    if (Utilities.isUndefined(width)) return this.canvas.clientWidth;
    this.resize(width, null);
    return this;
  };

   /**
    * grapher.height
    * ------------------
    *
    * Specify or retrieve the height.
    */
  Grapher.prototype.height = function (height) {
    if (Utilities.isUndefined(height)) return this.canvas.clientHeight;
    this.resize(null, height);
    return this;
  };

  /**
    * grapher.transform
    * ------------------
    *
    * Set the scale and translate as an object.
    * If no arguments are passed in, returns the current transform object.
    */
  Grapher.prototype.transform = function (transform) {
    if (Utilities.isUndefined(transform))
      return {scale: this.props.scale, translate: this.props.translate};

    this.scale(transform.scale);
    this.translate(transform.translate);
    return this;
  };

  /**
    * grapher.nodeScale
    * ------------------
    *
    * Set the nodeScale. The displayed radius of the node will be the nodeScale multiplied by the node radius.
    * If no arguments are passed in, returns the current scale.
    */
  Grapher.prototype.nodeScale = function (scale) {
    if (Utilities.isUndefined(scale) || Utilities.isNaN(scale)) return this.props.nodeScale;
    if (Utilities.isNumber(scale)) this.props.nodeScale = scale;
    this.updateTransform = true;
    return this;
  };

  /**
    * grapher.scale
    * ------------------
    *
    * Set the scale. Scale can be a number or a tuple of numbers representing [x, y] scales.
    * If no arguments are passed in, returns the current scale.
    */
  Grapher.prototype.scale = function (scale) {
    if (Utilities.isUndefined(scale)) return this.props.scale;
    if (Utilities.isNumber(scale) || Utilities.isArray(scale)) this.props.scale = scale;
    this.updateTransform = true;
    return this;
  };

  /**
    * grapher.translate
    * ------------------
    *
    * Set the translate.
    * If no arguments are passed in, returns the current translate.
    */
  Grapher.prototype.translate = function (translate) {
    if (Utilities.isUndefined(translate)) return this.props.translate;
    if (Utilities.isArray(translate)) this.props.translate = translate;
    this.updateTransform = true;
    return this;
  };

  /**
    * grapher.color
    * ------------------
    *
    * Set the default color of nodes and links.
    * If no arguments are passed in, returns the current default color.
    */
  Grapher.prototype.color = function (color) {
    if (Utilities.isUndefined(color)) return this.props.color;
    this.props.color = Color.parse(color);
    return this;
  };

  /**
    * grapher.getDataPosition
    * ------------------
    *
    * Returns data space coordinates given display coordinates.
    * If a single argument passed in, function considers first argument an object with x and y props.
    */
  Grapher.prototype.getDataPosition = function (x, y) {
    var xCoord = Utilities.isUndefined(y) ? x.x : x;
    var yCoord = Utilities.isUndefined(y) ? x.y : y;
    x = this.renderer.untransformX(xCoord);
    y = this.renderer.untransformY(yCoord);
    return {x: x, y: y};
  };

  /**
    * grapher.getDisplayPosition
    * ------------------
    *
    * Returns display space coordinates given data coordinates.
    * If a single argument passed in, function considers first argument an object with x and y props.
    */
  Grapher.prototype.getDisplayPosition = function (x, y) {
    var xCoord = Utilities.isUndefined(y) ? x.x : x;
    var yCoord = Utilities.isUndefined(y) ? x.y : y;
    x = this.renderer.transformX(xCoord);
    y = this.renderer.transformY(yCoord);
    return {x: x, y: y};
  };

  /**
    * Private Functions
    * =================
    */

  /**
    * grapher._addToUpdateQueue
    * -------------------
    *
    * Add indices to the nodes or links update queue.
    *
    */
  Grapher.prototype._addToUpdateQueue = function (type, indices) {
    var willUpdate = type === NODES ? this.willUpdate.nodes : this.willUpdate.links,
        updateAll = type === NODES ? this.updateAll.nodes : this.updateAll.links,
        spriteSet = type === NODES ? this.nodes : this.links;

    var insert = function (n) { Utilities.uniqueInsert(willUpdate, n); };
    if (!updateAll && Utilities.isArray(indices)) Utilities.each(indices, insert, this);

    updateAll = updateAll || willUpdate.length >= spriteSet.length;

    if (type === NODES) this.updateAll.nodes = updateAll;
    else this.updateAll.links = updateAll;
  };

  /**
    * grapher._clearUpdateQueue
    * -------------------
    *
    * Clear the update queue.
    *
    */
  Grapher.prototype._clearUpdateQueue = function () {
    this.willUpdate.links = [];
    this.willUpdate.nodes = [];
    this.updateAll.links = false;
    this.updateAll.nodes = false;
    this.updateTransform = false;
  };

  /**
    * grapher._update
    * -------------------
    *
    * Update nodes and links in the update queue.
    *
    */
  Grapher.prototype._update = function () {
    var updatingLinks = this.willUpdate.links;
    var updatingNodes = this.willUpdate.nodes;

    if (this.updateAll.links) Utilities.each(this.links, this._updateLink);
    else if (updatingLinks && updatingLinks.length) Utilities.eachPop(updatingLinks, this._updateLinkByIndex);

    if (this.updateAll.nodes) Utilities.each(this.nodes, this._updateNode);
    else if (updatingNodes && updatingNodes.length) Utilities.eachPop(updatingNodes, this._updateNodeByIndex);

    if (this.updateTransform) {
      this.renderer.setNodeScale(this.props.nodeScale);
      this.renderer.setScale(this.props.scale);
      this.renderer.setTranslate(this.props.translate);
    }

    this._clearUpdateQueue();
  };

  Grapher.prototype._updateLink = function (link, i) {
    var data = this.data(),
        l = data.links[i],
        from = data.nodes[l.from],
        to = data.nodes[l.to];

    var color = !Utilities.isUndefined(l.color) ? this._findColor(l.color) :
        Color.interpolate(this._findColor(from.color), this._findColor(to.color));

    link.update(from.x, from.y, to.x, to.y, color);
  };

  Grapher.prototype._updateNode = function (node, i) {
    var n = this.data().nodes[i];
    node.update(n.x, n.y, n.r, this._findColor(n.color));
  };

  Grapher.prototype._updateNodeByIndex = function (i) { this._updateNode(this.nodes[i], i); };

  Grapher.prototype._updateLinkByIndex = function (i) { this._updateLink(this.links[i], i); };

  /**
    * grapher._findLinks
    * -------------------
    *
    * Search for links connected to the node indices provided.
    *
    * isLinked is a helper function that returns true if a link is
    * connected to a node in indices.
    */
  var isLinked = function (indices, l) {
    var i, len = indices.length, flag = false;
    for (i = 0; i < len; i++) {
      if (l.to == indices[i] || l.from == indices[i]) {
        flag = true;
        break;
      }
    }
    return flag;
  };

  Grapher.prototype._findLinks = function (indices) {
    var links = this.data().links,
        i, numLinks = links.length,
        updatingLinks = [];

    for (i = 0; i < numLinks; i++) {
      if (isLinked(indices, links[i])) updatingLinks.push(i);
    }

    return updatingLinks;
  };

  /**
    * grapher._findColor
    * -------------------
    *
    * Search for a color whether it's defined by palette index, string,
    * integer.
    */
  Grapher.prototype._findColor = function (c) {
    var color = Color.parse(c);

    // if color is still not set, use the default
    if (Utilities.isUndefined(color)) color = this.color();
    return color;
  };

  /**
    * grapher._getWebGL
    * -------------------
    *
    * get webGL context if available
    *
    */
  Grapher.prototype._getWebGL = function () {
    var gl = null;
    try { gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl"); }
    catch (x) { gl = null; }
    return gl;
  };

  /**
    * grapher._onContextLost
    * ----------------------
    *
    * Handle context lost.
    *
    */
  Grapher.prototype._onContextLost = function (e) {
    e.preventDefault();
    if (this.currentFrame) cancelAnimationFrame(this.currentFrame);
  };

  /**
    * grapher._onContextRestored
    * --------------------------
    *
    * Handle context restored.
    *
    */
  Grapher.prototype._onContextRestored = function () {
    var webGL = this._getWebGL();
    this.renderer.initGL(webGL);
    if (this.currentFrame) this.play(); // Play the graph if it was running.
    else if (this.rendered) this.render();
  };

  return Grapher;

})));


},{}],3:[function(require,module,exports){
;(function () {
  /**
    * Helper functions and distance calculations
    */
  function square (a) {
    return a * a;
  }

  function getDistanceFunction (point, fn) {
    return function (obj) { return fn(point, obj); };
  }

  function distSquared (p1, p2) {
    return square(p2.x - p1.x) + square(p2.y - p1.y);
  }

  function distToLineSquared (p1, l1, l2) {
    var dot = (p1.x - l1.x) * (l2.x - l1.x) + (p1.y - l1.y) * (l2.y - l1.y),
        ratio = dot / distSquared(l1, l2);
    if (ratio < 0) return distSquared(p1, l1);
    if (ratio > 1) return distSquared(p1, l2);
    return distSquared(
      p1,
      {
        x: l1.x + ratio * (l2.x - l1.x),
        y: l1.y + ratio * (l2.y - l1.y)
      }
    );
  }

  function nodeDistanceSquared (point, node) {
    // preserve monomorphism
    node = {x: node.x, y: node.y};
    return distSquared(point, node);
  }

  function linkDistanceSquared (point, link) {
    // preserve monomorphism
    var nodes = this.data().nodes,
        from = {x: nodes[link.from].x, y: nodes[link.from].y},
        to = {x: nodes[link.to].x, y: nodes[link.to].y};
    return distToLineSquared(point, from, to);
  }

  var target = function (g) {
    /**
      * grapher.target
      * ------------------
      * 
      * A naive target node/link implementation. Finds the node or link at the point ({x, y}).
      *
      * @param point    an object containing x, y attributes in data space
      * @param type     (optional, defaults to 'nodes') nodes' or 'links'
      *
      */
    g.prototype.target = function (point, type) {
      type = type || g.NODES;
      if (type == g.LINKS) return this.targetLink(point);
      else return this.targetNode(point);
    };

    g.prototype.targetNode = function (point) {
      var node = -1,
          isTarget = function (n, i) {
            var found = nodeDistanceSquared(point, n) <= square(n.r);
            if (found) node = i;
            return !found;
          };
      this.data().nodes.every(isTarget);
      return node;
    };

    g.prototype.targetLink = function (point) {
      var link = -1,
          lineWidth = this.renderer.lineWidth,
          d = linkDistanceSquared.bind(this),
          isTarget = function (l, i) {
            var found = d(point, l) <= square(lineWidth);
            if (found) link = i;
            return !found;
          };
      this.data().links.every(isTarget);
      return link;
    };

    /**
      * grapher.nearest
      * ------------------
      * 
      * A naive nearest node/link implementation.
      * Returns an array of node or link indices sorted by smallest to largest distance.
      *
      * @param point    an object containing x, y attributes in data space
      * @param type     (optional, defaults to 'nodes') nodes' or 'links'
      * @param options  (optional) an object containing:
      *          - d      (default euclidean squared) a distance function that takes two args -- a point and a node or link
      *          - count  (default 1) the number of nearest nodes or links to return
      *
      */
    g.prototype.nearest = function (point, type, options) {
      type = type || g.NODES;
      if (type == g.LINKS) return this.nearestLink(point, options);
      else return this.nearestNode(point, options);
    };

    g.prototype.nearestNode = function (dataPoint, options) {
      var d = options && options.d || nodeDistanceSquared;
      var count = options && options.count || 1;
      var distances = [],
          sorted = [];

      d = getDistanceFunction(dataPoint, d);

      this.data().nodes.forEach(function (n, i) {
        var dist = d(n);
        var index = g.utils.sortedIndex(distances, dist);
        distances.splice(index, 0, dist);
        sorted.splice(index, 0, i);
        if (distances.length > count) {
          // trim both arrays so that splicing isn't excessive
          // this fixes a performance problem caused in Chrome 66:
          // https://bugs.chromium.org/p/chromium/issues/detail?id=835558
          distances.splice(-1, 1);
          sorted.splice(-1, 1);
        }
      });

      return sorted;
    };

    g.prototype.nearestLink = function (dataPoint, options) {
      var d = options && options.d || linkDistanceSquared.bind(this);
      var count = options && options.count || 1;
      var distances = [],
          sorted = [];

      d = getDistanceFunction(dataPoint, d);
      this.data().links.forEach(function (l, i) {
        var dist = d(l);
        var index = g.utils.sortedIndex(distances, dist);
        distances.splice(index, 0, dist);
        sorted.splice(index, 0, i);
        if (distances.length > count) {
          // trim both arrays so that splicing isn't excessive
          // this fixes a performance problem caused in Chrome 66:
          // https://bugs.chromium.org/p/chromium/issues/detail?id=835558
          distances.splice(-1, 1);
          sorted.splice(-1, 1);
        }
      });

      return sorted;
    };
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = target;
  } else {
    /* globals Grapher */
    target(Grapher);
  }
})();

},{}]},{},[1]);
