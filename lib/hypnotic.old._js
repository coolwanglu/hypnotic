/* -*- Mode: JS; tab-width: 4; indent-tabs-mode: nil; -*-
 * vim: set sw=4 ts=4 et tw=78 ft=javascript : */
 
/* hyponotic._js
 * Copyright (c) 2013 Lu Wang <coolwanglu@gmail.com>
 * Modified for hypnotic:
 *  - removed conditional catch() for streamlinejs
 *  - converted the interpreter async, to be compiled by streamlinejs
 *  - define async functions
 */

/* ***** BEGIN LICENSE BLOCK *****
 *
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Narcissus JavaScript engine.
 *
 * The Initial Developer of the Original Code is
 * Brendan Eich <brendan@mozilla.org>.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Tom Austin <taustin@ucsc.edu>
 *   Brendan Eich <brendan@mozilla.org>
 *   Shu-Yu Guo <shu@rfrn.org>
 *   Dave Herman <dherman@mozilla.com>
 *   Dimitris Vardoulakis <dimvar@ccs.neu.edu>
 *   Patrick Walton <pcwalton@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */


// pre-condition: Narcissus is loaded (the Narcissus object has been set up)
window.Hypnotic = window.Hypnotic || (function(){

    /*
     * Hypnotic are wrapper of functions
     * the func should accept a callback function as the first argument
     * the JavaScript interpreter would go to sleep until the callback
     * function is called
     * do not support return values yet
     */
    function Hypnotic(fn) { this.fn = fn; }
    Hypnotic.execute = function (script, cb) {
        evaluate(script, '__string__', 0, cb || function(){});
    };
    Hypnotic.prototype = {
        toSource: function () { return this.fn.toSource(); },
        // for Narcissus
        __call__: function (obj, args, scope, callback) {
            // forward the callback to func
            // need to define a function without a '_' arg
            // such that it won't be transformed by streamlinejs
            var new_args = [];
            new_args.push(callback);
            for(var i = 0, l = args.length; i < l; ++i)
                new_args.push(args[i]);
            return this.fn.apply(obj, new_args);
        }
    };



/*
 * Narcissus - JS implemented in JS.
 *
 * Execution of parse trees.
 *
 * Standard classes except for eval, Function, Array, and String are borrowed
 * from the host JS environment.  Function is metacircular.  Array and String
 * are reflected via wrapping the corresponding native constructor and adding
 * an extra level of prototype-based delegation.
 */

    var parser = Narcissus.parser;
    var definitions = Narcissus.definitions;
    var hostGlobal = Narcissus.hostGlobal;

    // Set constants in the local scope.
    eval(definitions.consts);

    const GLOBAL_CODE = 0, EVAL_CODE = 1, FUNCTION_CODE = 2;

    function ExecutionContext(type) {
        this.type = type;
    }

    function isStackOverflow(e) {
        var re = /InternalError: (script stack space quota is exhausted|too much recursion)/;
        return re.test(e.toString());
    }

    // The underlying global object for narcissus.
    var globalBase = {
        // Value properties.
        NaN: NaN, Infinity: Infinity, undefined: undefined,

        // Function properties.
        eval: function eval(s) {
            if (typeof s !== "string")
                return s;

            var x = ExecutionContext.current;
            var x2 = new ExecutionContext(EVAL_CODE);
            x2.thisObject = x.thisObject;
            x2.caller = x.caller;
            x2.callee = x.callee;
            x2.scope = x.scope;
            try {
                console.log('TODO:eval()!!!');
                x2.execute(parser.parse(s));
                return x2.result;
            } catch (e) {
                if (e instanceof SyntaxError || isStackOverflow(e)) {
                    /*
                     * If we get an internal error during parsing we need to reify
                     * the exception as a Narcissus THROW.
                     *
                     * See bug 152646.
                     */
                    console.log('internal error:',e);
                    x.result = e;
                    throw THROW;
                } else {
                    throw e;
                }
            }
        },

        // Class constructors.  Where ECMA-262 requires C.length === 1, we declare
        // a dummy formal parameter.
        Function: function Function(dummy) {
            var p = "", b = "", n = arguments.length;
            if (n) {
                var m = n - 1;
                if (m) {
                    p += arguments[0];
                    for (var k = 1; k < m; k++)
                        p += "," + arguments[k];
                }
                b += arguments[m];
            }

            // XXX We want to pass a good file and line to the tokenizer.
            // Note the anonymous name to maintain parity with Spidermonkey.
            var t = new parser.Tokenizer("anonymous(" + p + ") {" + b + "}");

            // NB: Use the STATEMENT_FORM constant since we don't want to push this
            // function onto the fake compilation context.
            var f = parser.FunctionDefinition(t, null, false, parser.STATEMENT_FORM);
            var s = {object: global, parent: null};
            return newFunction(f,{scope:s});
        },
        Array: function (dummy) {
            // Array when called as a function acts as a constructor.
            return Array.apply(this, arguments);
        },
        String: function String(s) {
            // Called as function or constructor: convert argument to string type.
            s = arguments.length ? "" + s : "";
            if (this instanceof String) {
                // Called as constructor: save the argument as the string value
                // of this String object and return this object.
                this.value = s;
                return this;
            }
            return s;
        },

        // Don't want to proxy RegExp or some features won't work
        RegExp: RegExp,

        // Extensions to ECMA.
        load: function load(s) {
            if (typeof s !== "string")
                return s;

            console.log('TODO:load()!!!');
            evaluate(snarf(s), s, 1)
        },
        version: function() { return Narcissus.options.version; },
        quit: function() { throw END; },

        sleep: new Hypnotic( function(cb,ms){ setTimeout(cb, ms); } )
    };

    var narcissusGlobal = {};
    function resetEnvironment() {
        ExecutionContext.current = new ExecutionContext(GLOBAL_CODE);
        for (var key in narcissusGlobal) {
            delete narcissusGlobal[key];
        }
        for (var key in globalBase) {
            narcissusGlobal[key] = globalBase[key];
        }
    }
    resetEnvironment();

    // Create global handler with needed modifications.
    var globalHandler = definitions.makePassthruHandler(narcissusGlobal);

    globalHandler.has = function(name) {
        if (name in narcissusGlobal)
            return true;
        // Hide Narcissus implementation code.
        if (name === "Narcissus")
            return false;
        // Hide Hypnotic
        if (name === "Hypnotic")
            return false;
        if (name in hostGlobal)
            return true;
        return Narcissus.definitions.noPropFound(name);
    };

    globalHandler.get = function(receiver, name) {
        if (narcissusGlobal.hasOwnProperty(name))
            return narcissusGlobal[name];

        var globalProp = hostGlobal[name];
        if (definitions.isNativeCode(globalProp)) {
            // Enables native browser functions like 'alert' to work correctly.
            return Proxy.createFunction(
                definitions.makePassthruHandler(globalProp),
                function() { return globalProp.apply(hostGlobal, arguments); },
                function() {
                    var a = arguments;
                    switch (a.length) {
                      case 0:
                        return new globalProp();
                      case 1:
                        return new globalProp(a[0]);
                      case 2:
                        return new globalProp(a[0], a[1]);
                      case 3:
                        return new globalProp(a[0], a[1], a[2]);
                      default:
                        var argStr = "";
                        for (var i = 0; i < a.length; i++)
                            argStr += 'a[' + i + '],';
                        return eval('new ' + name + '(' + argStr.slice(0,-1) + ');');
                    }
                });
        }
        // If globalProp is not found, call the noPropFound hook.
        return globalProp ? globalProp : Narcissus.definitions.noPropFound(name);
    };

    var global = Proxy.create(globalHandler);

    // Helper to avoid Object.prototype.hasOwnProperty polluting scope objects.
    function hasDirectProperty(o, p) {
        return Object.prototype.hasOwnProperty.call(o, p);
    }

    // Reflect a host class into the target global environment by delegation.
    function reflectClass(name, proto) {
        var gctor = global[name];
        definitions.defineProperty(gctor, "prototype", proto, true, true, true);
        definitions.defineProperty(proto, "constructor", gctor, false, false, true);
        return proto;
    }

    // Reflect Array -- note that all Array methods are generic.
    reflectClass('Array', new Array);

    // Reflect String, overriding non-generic methods.
    var gSp = reflectClass('String', new String);
    gSp.toSource = function () { return this.value.toSource(); };
    gSp.toString = function () { return this.value; };
    gSp.valueOf  = function () { return this.value; };
    global.String.fromCharCode = String.fromCharCode;

    ExecutionContext.current = null;

    ExecutionContext.prototype = {
        caller: null,
        callee: null,
        scope: {object: global, parent: null},
        thisObject: global,
        result: undefined,
        target: null,
        ecma3OnlyMode: false,

        // Execute a node in this execution context.
        execute: function(n, _) {
            var prev = ExecutionContext.current;
            ExecutionContext.current = this;
            try {
                execute(n, this, _);
            } catch (e) {
                if (e === THROW) {
                    // Propagate the throw to the previous context if it exists.
                    if (prev) {
                        prev.result = this.result;
                        throw THROW;
                    }
                    // Otherwise reflect the throw into host JS.
                    throw this.result;
                } else {
                    throw e;
                }
            } finally {
                ExecutionContext.current = prev;
            }
        }
    };

    function Reference(base, propertyName, node) {
        this.base = base;
        this.propertyName = propertyName;
        this.node = node;
    }

    Reference.prototype.toString = function () { return this.node.getSource(); }

    function getValue(v) {
        if (v instanceof Reference) {
            if (!v.base) {
                throw new ReferenceError(v.propertyName + " is not defined",
                                         v.node.filename, v.node.lineno);
            }
            return v.base[v.propertyName];
        }
        return v;
    }

    function putValue(v, w, vn) {
        if (v instanceof Reference)
            return (v.base || global)[v.propertyName] = w;
        throw new ReferenceError("Invalid assignment left-hand side",
                                 vn.filename, vn.lineno);
    }

    function isPrimitive(v) {
        var t = typeof v;
        return (t === "object") ? v === null : t !== "function";
    }

    function isObject(v) {
        var t = typeof v;
        return (t === "object") ? v !== null : t === "function";
    }

    // If r instanceof Reference, v === getValue(r); else v === r.  If passed, rn
    // is the node whose execute result was r.
    function toObject(v, r, rn) {
        switch (typeof v) {
          case "boolean":
            return new global.Boolean(v);
          case "number":
            return new global.Number(v);
          case "string":
            return new global.String(v);
          case "function":
            return v;
          case "object":
            if (v !== null)
                return v;
        }
        var message = r + " (type " + (typeof v) + ") has no properties";
        throw rn ? new TypeError(message, rn.filename, rn.lineno)
                 : new TypeError(message);
    }

    function execute(n, x, _) {
        var a, c, f, i, j, r, s, t, u, v;

        switch (n.type) {
          case FUNCTION:
            if (n.functionForm !== parser.DECLARED_FORM) {
                if (!n.name || n.functionForm === parser.STATEMENT_FORM) {
                    v = newFunction(n, x);
                    if (n.functionForm === parser.STATEMENT_FORM)
                        definitions.defineProperty(x.scope.object, n.name, v, true);
                } else {
                    t = new Object;
                    x.scope = {object: t, parent: x.scope};
                    try {
                        v = newFunction(n, x);
                        definitions.defineProperty(t, n.name, v, true, true);
                    } finally {
                        x.scope = x.scope.parent;
                    }
                }
            }
            break;

          case SCRIPT:
            t = x.scope.object;
            a = n.funDecls;
            for (i = 0, j = a.length; i < j; i++) {
                s = a[i].name;
                f = newFunction(a[i], x);
                definitions.defineProperty(t, s, f, x.type !== EVAL_CODE);
            }
            a = n.varDecls;
            for (i = 0, j = a.length; i < j; i++) {
                u = a[i];
                s = u.name;
                if (u.readOnly && hasDirectProperty(t, s)) {
                    throw new TypeError("Redeclaration of const " + s,
                                        u.filename, u.lineno);
                }
                if (u.readOnly || !hasDirectProperty(t, s)) {
                    // Does not correctly handle 'const x;' -- see bug 592335.
                    definitions.defineProperty(t, s, undefined, x.type !== EVAL_CODE, false);
                }
            }
            c = n.children;
            for (i = 0, j = c.length; i < j; i++)
                execute(c[i], x, _);
            break;

          case BLOCK:
            c = n.children;
            for (i = 0, j = c.length; i < j; i++)
                execute(c[i], x, _);
            break;

          case IF:
            if (getValue(execute(n.condition, x, _)))
                execute(n.thenPart, x, _);
            else if (n.elsePart)
                execute(n.elsePart, x, _);
            break;

          case SWITCH:
            s = getValue(execute(n.discriminant, x, _));
            a = n.cases;
            var matchDefault = false;
            var break_loop = false;
            for (i = 0, j = a.length; ; i++) {
                if (i === j) {
                    if (n.defaultIndex >= 0) {
                        i = n.defaultIndex - 1; // no case matched, do default
                        matchDefault = true;
                        continue;
                    }
                    break;                      // no default, exit switch_loop
                }
                t = a[i];                       // next case (might be default!)
                if (t.type === CASE) {
                    u = getValue(execute(t.caseLabel, x, _));
                } else {
                    if (!matchDefault)          // not defaulting, skip for now
                        continue;
                    u = s;                      // force match to do default
                }
                if (u === s) {
                    for (;;) {                  // this loop exits switch_loop
                        if (t.statements.children.length) {
                            try {
                                execute(t.statements, x, _);
                            } catch (e) {
                                if (e === BREAK && x.target === n) {
                                    break_loop = true;
                                    break;
                                } else {
                                    throw e;
                                }
                            }
                        }
                        if (++i === j) {
                            break_loop = true;
                            break;
                        }
                        t = a[i];
                    }
                    if(break_loop)
                        break;
                }
            }
            break;

          case FOR:
            n.setup && getValue(execute(n.setup, x, _));
            while (!n.condition || getValue(execute(n.condition, x, _))) {
                try {
                    execute(n.body, x, _);
                } catch (e) {
                    if (e === BREAK && x.target === n) {
                        break;
                    } else if (e === CONTINUE && x.target === n) {
                        // Must run the update expression.
                    } else {
                        throw e;
                    }
                }
                n.update && getValue(execute(n.update, x, _));
            }
            break;
          case WHILE:
            while (!n.condition || getValue(execute(n.condition, x, _))) {
                try {
                    execute(n.body, x, _);
                } catch (e) {
                    if (e === BREAK && x.target === n) {
                        break;
                    } else if (e === CONTINUE && x.target === n) {
                        // Must run the update expression.
                    } else {
                        throw e;
                    }
                }
                n.update && getValue(execute(n.update, x, _));
            }
            break;

          case FOR_IN:
            u = n.varDecl;
            if (u)
                execute(u, x, _);
            r = n.iterator;
            s = execute(n.object, x, _);
            v = getValue(s);

            // ECMA deviation to track extant browser JS implementation behavior.
            t = ((v === null || v === undefined) && !x.ecma3OnlyMode)
                ? v
                : toObject(v, s, n.object);
            a = [];
            for (i in t)
                a.push(i);
            for (i = 0, j = a.length; i < j; i++) {
                putValue(execute(r, x, _), a[i], r);
                try {
                    execute(n.body, x, _);
                } catch (e) {
                    if (e === BREAK && x.target === n) {
                        break;
                    } else if (e === CONTINUE && x.target === n) {
                        continue;
                    } else {
                        throw e;
                    }
                }
            }
            break;

          case DO:
            do {
                try {
                    execute(n.body, x, _);
                } catch (e) {
                    if (e === BREAK && x.target === n) {
                        break;
                    } else if (e === CONTINUE && x.target === n) {
                        continue;
                    } else {
                        throw e;
                    }
                }
            } while (getValue(execute(n.condition, x, _)));
            break;

          case BREAK:
          case CONTINUE:
            x.target = n.target;
            throw n.type;

          case TRY:
            try {
                execute(n.tryBlock, x, _);
            } catch (e) {
                if (e === THROW && (j = n.catchClauses.length)) {
                    e = x.result;
                    x.result = undefined;
                    for (i = 0; ; i++) {
                        if (i === j) {
                            x.result = e;
                            throw THROW;
                        }
                        t = n.catchClauses[i];
                        x.scope = {object: {}, parent: x.scope};
                        definitions.defineProperty(x.scope.object, t.varName, e, true);
                        try {
                            if (t.guard && !getValue(execute(t.guard, x, _)))
                                continue;
                            execute(t.block, x, _);
                            break;
                        } finally {
                            x.scope = x.scope.parent;
                        }
                    }
                } else {
                    throw e;
                }
            } finally {
                if (n.finallyBlock)
                    execute(n.finallyBlock, x, _);
            }
            break;

          case THROW:
            x.result = getValue(execute(n.exception, x, _));
            throw THROW;

          case RETURN:
            // Check for returns with no return value
            x.result = n.value ? getValue(execute(n.value, x, _)) : undefined;
            throw RETURN;

          case WITH:
            r = execute(n.object, x, _);
            t = toObject(getValue(r), r, n.object);
            x.scope = {object: t, parent: x.scope};
            try {
                execute(n.body, x, _);
            } finally {
                x.scope = x.scope.parent;
            }
            break;

          case VAR:
          case CONST:
            c = n.children;
            for (i = 0, j = c.length; i < j; i++) {
                u = c[i].initializer;
                if (!u)
                    continue;
                t = c[i].name;
                for (s = x.scope; s; s = s.parent) {
                    if (hasDirectProperty(s.object, t))
                        break;
                }
                u = getValue(execute(u, x, _));
                if (n.type === CONST)
                    definitions.defineProperty(s.object, t, u, x.type !== EVAL_CODE, true);
                else
                    s.object[t] = u;
            }
            break;

          case DEBUGGER:
            throw "NYI: " + definitions.tokens[n.type];

          case SEMICOLON:
            if (n.expression)
                x.result = getValue(execute(n.expression, x, _));
            break;

          case LABEL:
            try {
                execute(n.statement, x, _);
            } catch (e) {
                if (e === BREAK && x.target === n.target) {
                } else {
                    throw e;
                }
            }
            break;

          case COMMA:
            c = n.children;
            for (i = 0, j = c.length; i < j; i++)
                v = getValue(execute(c[i], x, _));
            break;

          case ASSIGN:
            c = n.children;
            r = execute(c[0], x, _);
            t = n.assignOp;
            if (t)
                u = getValue(r);
            v = getValue(execute(c[1], x, _));
            if (t) {
                switch (t) {
                  case BITWISE_OR:  v = u | v; break;
                  case BITWISE_XOR: v = u ^ v; break;
                  case BITWISE_AND: v = u & v; break;
                  case LSH:         v = u << v; break;
                  case RSH:         v = u >> v; break;
                  case URSH:        v = u >>> v; break;
                  case PLUS:        v = u + v; break;
                  case MINUS:       v = u - v; break;
                  case MUL:         v = u * v; break;
                  case DIV:         v = u / v; break;
                  case MOD:         v = u % v; break;
                }
            }
            putValue(r, v, c[0]);
            break;

          case HOOK:
            c = n.children;
            v = getValue(execute(c[0], x, _)) ? getValue(execute(c[1], x, _))
                                           : getValue(execute(c[2], x, _));
            break;

          case OR:
            c = n.children;
            v = getValue(execute(c[0], x, _)) || getValue(execute(c[1], x, _));
            break;

          case AND:
            c = n.children;
            v = getValue(execute(c[0], x, _)) && getValue(execute(c[1], x, _));
            break;

          case BITWISE_OR:
            c = n.children;
            v = getValue(execute(c[0], x, _)) | getValue(execute(c[1], x, _));
            break;

          case BITWISE_XOR:
            c = n.children;
            v = getValue(execute(c[0], x, _)) ^ getValue(execute(c[1], x, _));
            break;

          case BITWISE_AND:
            c = n.children;
            v = getValue(execute(c[0], x, _)) & getValue(execute(c[1], x, _));
            break;

          case EQ:
            c = n.children;
            v = getValue(execute(c[0], x, _)) == getValue(execute(c[1], x, _));
            break;

          case NE:
            c = n.children;
            v = getValue(execute(c[0], x, _)) != getValue(execute(c[1], x, _));
            break;

          case STRICT_EQ:
            c = n.children;
            v = getValue(execute(c[0], x, _)) === getValue(execute(c[1], x, _));
            break;

          case STRICT_NE:
            c = n.children;
            v = getValue(execute(c[0], x, _)) !== getValue(execute(c[1], x, _));
            break;

          case LT:
            c = n.children;
            v = getValue(execute(c[0], x, _)) < getValue(execute(c[1], x, _));
            break;

          case LE:
            c = n.children;
            v = getValue(execute(c[0], x, _)) <= getValue(execute(c[1], x, _));
            break;

          case GE:
            c = n.children;
            v = getValue(execute(c[0], x, _)) >= getValue(execute(c[1], x, _));
            break;

          case GT:
            c = n.children;
            v = getValue(execute(c[0], x, _)) > getValue(execute(c[1], x, _));
            break;

          case IN:
            c = n.children;
            v = getValue(execute(c[0], x, _)) in getValue(execute(c[1], x, _));
            break;

          case INSTANCEOF:
            c = n.children;
            t = getValue(execute(c[0], x, _));
            u = getValue(execute(c[1], x, _));
            if (isObject(u) && typeof u.__hasInstance__ === "function")
                v = u.__hasInstance__(t);
            else
                v = t instanceof u;
            break;

          case LSH:
            c = n.children;
            v = getValue(execute(c[0], x, _)) << getValue(execute(c[1], x, _));
            break;

          case RSH:
            c = n.children;
            v = getValue(execute(c[0], x, _)) >> getValue(execute(c[1], x, _));
            break;

          case URSH:
            c = n.children;
            v = getValue(execute(c[0], x, _)) >>> getValue(execute(c[1], x, _));
            break;

          case PLUS:
            c = n.children;
            v = getValue(execute(c[0], x, _)) + getValue(execute(c[1], x, _));
            break;

          case MINUS:
            c = n.children;
            v = getValue(execute(c[0], x, _)) - getValue(execute(c[1], x, _));
            break;

          case MUL:
            c = n.children;
            v = getValue(execute(c[0], x, _)) * getValue(execute(c[1], x, _));
            break;

          case DIV:
            c = n.children;
            v = getValue(execute(c[0], x, _)) / getValue(execute(c[1], x, _));
            break;

          case MOD:
            c = n.children;
            v = getValue(execute(c[0], x, _)) % getValue(execute(c[1], x, _));
            break;

          case DELETE:
            t = execute(n.children[0], x, _);
            v = !(t instanceof Reference) || delete t.base[t.propertyName];
            break;

          case VOID:
            getValue(execute(n.children[0], x, _));
            break;

          case TYPEOF:
            t = execute(n.children[0], x, _);
            if (t instanceof Reference)
                t = t.base ? t.base[t.propertyName] : undefined;
            v = typeof t;
            break;

          case NOT:
            v = !getValue(execute(n.children[0], x, _));
            break;

          case BITWISE_NOT:
            v = ~getValue(execute(n.children[0], x, _));
            break;

          case UNARY_PLUS:
            v = +getValue(execute(n.children[0], x, _));
            break;

          case UNARY_MINUS:
            v = -getValue(execute(n.children[0], x, _));
            break;

          case INCREMENT:
          case DECREMENT:
            t = execute(n.children[0], x, _);
            u = Number(getValue(t));
            if (n.postfix)
                v = u;
            putValue(t, (n.type === INCREMENT) ? ++u : --u, n.children[0]);
            if (!n.postfix)
                v = u;
            break;

          case DOT:
            c = n.children;
            r = execute(c[0], x, _);
            t = getValue(r);
            u = c[1].value;
            v = new Reference(toObject(t, r, c[0]), u, n);
            break;

          case INDEX:
            c = n.children;
            r = execute(c[0], x, _);
            t = getValue(r);
            u = getValue(execute(c[1], x, _));
            v = new Reference(toObject(t, r, c[0]), String(u), n);
            break;

          case LIST:
            // Curse ECMA for specifying that arguments is not an Array object!
            v = {};
            c = n.children;
            for (i = 0, j = c.length; i < j; i++) {
                u = getValue(execute(c[i], x, _));
                definitions.defineProperty(v, i, u, false, false, true);
            }
            definitions.defineProperty(v, "length", i, false, false, true);
            break;

          case CALL:
            c = n.children;
            r = execute(c[0], x, _);
            a = execute(c[1], x, _);
            f = getValue(r);
            if (isPrimitive(f) || typeof f.__call__ !== "function") {
                throw new TypeError(r + " is not callable", c[0].filename, c[0].lineno);
            }
            t = (r instanceof Reference) ? r.base : null;
            if (t instanceof Activation)
                t = null;
            v = f.__call__(t, a, x, _);
            break;

          case NEW:
          case NEW_WITH_ARGS:
            c = n.children;
            r = execute(c[0], x, _);
            f = getValue(r);
            if (n.type === NEW) {
                a = {};
                definitions.defineProperty(a, "length", 0, false, false, true);
            } else {
                a = execute(c[1], x, _);
            }
            if (isPrimitive(f) || typeof f.__construct__ !== "function") {
                throw new TypeError(r + " is not a constructor", c[0].filename, c[0].lineno);
            }
            v = f.__construct__(a, x, _);
            break;

          case ARRAY_INIT:
            v = [];
            c = n.children;
            for (i = 0, j = c.length; i < j; i++) {
                if (c[i])
                    v[i] = getValue(execute(c[i], x, _));
            }
            v.length = j;
            break;

          case OBJECT_INIT:
            v = {};
            c = n.children;
            for (i = 0, j = c.length; i < j; i++) {
                t = c[i];
                if (t.type === PROPERTY_INIT) {
                    var c2 = t.children;
                    v[c2[0].value] = getValue(execute(c2[1], x, _));
                } else {
                    f = newFunction(t, x);
                    u = (t.type === GETTER) ? '__defineGetter__'
                                            : '__defineSetter__';
                    v[u](t.name, thunk(f, x));
                }
            }
            break;

          case NULL:
            v = null;
            break;

          case THIS:
            v = x.thisObject;
            break;

          case TRUE:
            v = true;
            break;

          case FALSE:
            v = false;
            break;

          case IDENTIFIER:
            for (s = x.scope; s; s = s.parent) {
                if (n.value in s.object)
                    break;
            }
            v = new Reference(s && s.object, n.value, n);
            break;

          case NUMBER:
          case STRING:
          case REGEXP:
            v = n.value;
            break;

          case GROUP:
            v = execute(n.children[0], x, _);
            break;

          default:
            throw "PANIC: unknown operation " + n.type + ": " + uneval(n);
        }

        return v;
    }

    function Activation(f, a) {
        for (var i = 0, j = f.params.length; i < j; i++)
            definitions.defineProperty(this, f.params[i], a[i], true);
        definitions.defineProperty(this, "arguments", a, true);
    }

    // Null Activation.prototype's proto slot so that Object.prototype.* does not
    // pollute the scope of heavyweight functions.  Also delete its 'constructor'
    // property so that it doesn't pollute function scopes.

    Activation.prototype.__proto__ = null;
    delete Activation.prototype.constructor;

    function FunctionObject(node, scope) {
        this.node = node;
        this.scope = scope;
        definitions.defineProperty(this, "length", node.params.length, true, true, true);
        var proto = {};
        definitions.defineProperty(this, "prototype", proto, true);
        definitions.defineProperty(proto, "constructor", this, false, false, true);
    }

    function getPropertyDescriptor(obj, name) {
        while (obj) {
            if (({}).hasOwnProperty.call(obj, name))
                return Object.getOwnPropertyDescriptor(obj, name);
            obj = Object.getPrototypeOf(obj);
        }
    }

    function getOwnProperties(obj) {
        var map = {};
        for (var name in Object.getOwnPropertyNames(obj))
            map[name] = Object.getOwnPropertyDescriptor(obj, name);
        return map;
    }

    // Returns a new function wrapped with a Proxy.
    function newFunction(n, x) {
        var fobj = new FunctionObject(n, x.scope);
        var handler = definitions.makePassthruHandler(fobj);
        var p = Proxy.createFunction(handler,
                                     function() { return fobj.__call__(this, arguments, x, function(){}); },
                                     function() { return fobj.__construct__(arguments, x, function(){}); });
        return p;
    }

    var FOp = FunctionObject.prototype = {

        // Internal methods.
        __call__: function (t, a, x, _) {
            var x2 = new ExecutionContext(FUNCTION_CODE);
            x2.thisObject = t || global;
            x2.caller = x;
            x2.callee = this;
            definitions.defineProperty(a, "callee", this, false, false, true);
            var f = this.node;
            x2.scope = {object: new Activation(f, a), parent: this.scope};

            try {
                x2.execute(f.body, _);
            } catch (e) {
                if (e === RETURN) {
                    return x2.result;
                } else {
                    throw e;
                }
            }
            return undefined;
        },

        __construct__: function (a, x, _) {
            var o = new Object;
            var p = this.prototype;
            if (isObject(p))
                o.__proto__ = p;
            // else o.__proto__ defaulted to Object.prototype

            var v = this.__call__(o, a, x, _);
            if (isObject(v))
                return v;
            return o;
        },

        __hasInstance__: function (v) {
            if (isPrimitive(v))
                return false;
            var p = this.prototype;
            if (isPrimitive(p)) {
                throw new TypeError("'prototype' property is not an object",
                                    this.node.filename, this.node.lineno);
            }
            var o;
            while ((o = v.__proto__)) {
                if (o === p)
                    return true;
                v = o;
            }
            return false;
        },

        // Standard methods.
        toString: function () {
            return this.node.getSource();
        },

        apply: function (t, a, cb) {
            cb = cb || function() {};

            // Curse ECMA again!
            if (typeof this.__call__ !== "function") {
                throw new TypeError("Function.prototype.apply called on" +
                                    " uncallable object");
            }

            if (t === undefined || t === null)
                t = global;
            else if (typeof t !== "object")
                t = toObject(t, t);

            if (a === undefined || a === null) {
                a = {};
                definitions.defineProperty(a, "length", 0, false, false, true);
            } else if (a instanceof Array) {
                var v = {};
                for (var i = 0, j = a.length; i < j; i++)
                    definitions.defineProperty(v, i, a[i], false, false, true);
                definitions.defineProperty(v, "length", i, false, false, true);
                a = v;
            } else if (!(a instanceof Object)) {
                // XXX check for a non-arguments object
                throw new TypeError("Second argument to Function.prototype.apply" +
                                    " must be an array or arguments object",
                                    this.node.filename, this.node.lineno);
            }

            return this.__call__(t, a, ExecutionContext.current, cb);
        },

        call: function (t) {
            // Curse ECMA a third time!
            var a = Array.prototype.splice.call(arguments, 1);
            return this.apply(t, a);
        }
    };

    // Connect Function.prototype and Function.prototype.constructor in global.
    reflectClass('Function', FOp);

    // Help native and host-scripted functions be like FunctionObjects.
    var Fp = Function.prototype;
    var REp = RegExp.prototype;

    if (!('__call__' in Fp)) {
        definitions.defineProperty(Fp, "__call__",
                                   function (t, a, x, _) {
                                       // Curse ECMA yet again!
                                       a = Array.prototype.splice.call(a, 0, a.length);
                                       return this.apply(t, a);
                                   }, true, true, true);
        definitions.defineProperty(REp, "__call__",
                                   function (t, a, x) {
                                       a = Array.prototype.splice.call(a, 0, a.length);
                                       return this.exec.apply(this, a);
                                   }, true, true, true);
        definitions.defineProperty(Fp, "__construct__",
                                   function (a, x, _) {
                                       a = Array.prototype.splice.call(a, 0, a.length);
                                       switch (a.length) {
                                         case 0:
                                           return new this();
                                         case 1:
                                           return new this(a[0]);
                                         case 2:
                                           return new this(a[0], a[1]);
                                         case 3:
                                           return new this(a[0], a[1], a[2]);
                                         default:
                                           var argStr = "";
                                           for (var i=0; i<a.length; i++) {
                                               argStr += 'a[' + i + '],';
                                           }
                                           return eval('new this(' + argStr.slice(0,-1) + ');');
                                       }
                                   }, true, true, true);

        // Since we use native functions such as Date along with host ones such
        // as global.eval, we want both to be considered instances of the native
        // Function constructor.
        definitions.defineProperty(Fp, "__hasInstance__",
                                   function (v) {
                                       return v instanceof Function || v instanceof global.Function;
                                   }, true, true, true);
    }

    function thunk(f, x) {
        console.log('TODO:thunk!!!');
        return function () { return f.__call__(this, arguments, x); };
    }

    function evaluate(s, f, l, _) {
        if (typeof s !== "string")
            return s;

        var x = new ExecutionContext(GLOBAL_CODE);
        x.execute(parser.parse(s, f, l), _);
        return x.result;
    }
    return Hypnotic;
})();
