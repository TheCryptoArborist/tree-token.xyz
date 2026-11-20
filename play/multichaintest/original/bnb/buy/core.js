var r1 = Object.defineProperty;
var tr = (e) => {
  throw TypeError(e);
};
var i1 = (e, t, n) => t in e ? r1(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var m0 = (e, t, n) => i1(e, typeof t != "symbol" ? t + "" : t, n), wa = (e, t, n) => t.has(e) || tr("Cannot " + n);
var g = (e, t, n) => (wa(e, t, "read from private field"), n ? n.call(e) : t.get(e)), o0 = (e, t, n) => t.has(e) ? tr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), W = (e, t, n, a) => (wa(e, t, "write to private field"), a ? a.call(e, n) : t.set(e, n), n), Y = (e, t, n) => (wa(e, t, "access private method"), n);
const c1 = "1.2.3";
let ue = class Ja extends Error {
  constructor(t, n = {}) {
    var i;
    const a = n.cause instanceof Ja ? n.cause.details : (i = n.cause) != null && i.message ? n.cause.message : n.details, s = n.cause instanceof Ja && n.cause.docsPath || n.docsPath, r = [
      t || "An error occurred.",
      "",
      ...n.metaMessages ? [...n.metaMessages, ""] : [],
      ...s ? [`Docs: https://abitype.dev${s}`] : [],
      ...a ? [`Details: ${a}`] : [],
      `Version: abitype@${c1}`
    ].join(`
`);
    super(r), Object.defineProperty(this, "details", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "docsPath", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "metaMessages", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "shortMessage", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "AbiTypeError"
    }), n.cause && (this.cause = n.cause), this.details = a, this.docsPath = s, this.metaMessages = n.metaMessages, this.shortMessage = t;
  }
};
function Ye(e, t) {
  const n = e.exec(t);
  return n == null ? void 0 : n.groups;
}
const wi = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/, Ti = /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/, vi = /^\(.+?\).*?$/, nr = /^tuple(?<array>(\[(\d*)\])*)$/;
function Ya(e) {
  let t = e.type;
  if (nr.test(e.type) && "components" in e) {
    t = "(";
    const n = e.components.length;
    for (let s = 0; s < n; s++) {
      const r = e.components[s];
      t += Ya(r), s < n - 1 && (t += ", ");
    }
    const a = Ye(nr, e.type);
    return t += `)${(a == null ? void 0 : a.array) || ""}`, Ya({
      ...e,
      type: t
    });
  }
  return "indexed" in e && e.indexed && (t = `${t} indexed`), e.name ? `${t} ${e.name}` : t;
}
function Gt(e) {
  let t = "";
  const n = e.length;
  for (let a = 0; a < n; a++) {
    const s = e[a];
    t += Ya(s), a !== n - 1 && (t += ", ");
  }
  return t;
}
function o1(e) {
  var t;
  return e.type === "function" ? `function ${e.name}(${Gt(e.inputs)})${e.stateMutability && e.stateMutability !== "nonpayable" ? ` ${e.stateMutability}` : ""}${(t = e.outputs) != null && t.length ? ` returns (${Gt(e.outputs)})` : ""}` : e.type === "event" ? `event ${e.name}(${Gt(e.inputs)})` : e.type === "error" ? `error ${e.name}(${Gt(e.inputs)})` : e.type === "constructor" ? `constructor(${Gt(e.inputs)})${e.stateMutability === "payable" ? " payable" : ""}` : e.type === "fallback" ? `fallback() external${e.stateMutability === "payable" ? " payable" : ""}` : "receive() external payable";
}
const Ii = /^error (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function d1(e) {
  return Ii.test(e);
}
function f1(e) {
  return Ye(Ii, e);
}
const Oi = /^event (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function u1(e) {
  return Oi.test(e);
}
function l1(e) {
  return Ye(Oi, e);
}
const Ei = /^function (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)(?: (?<scope>external|public{1}))?(?: (?<stateMutability>pure|view|nonpayable|payable{1}))?(?: returns\s?\((?<returns>.*?)\))?$/;
function b1(e) {
  return Ei.test(e);
}
function p1(e) {
  return Ye(Ei, e);
}
const Si = /^struct (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*) \{(?<properties>.*?)\}$/;
function ki(e) {
  return Si.test(e);
}
function m1(e) {
  return Ye(Si, e);
}
const Ni = /^constructor\((?<parameters>.*?)\)(?:\s(?<stateMutability>payable{1}))?$/;
function g1(e) {
  return Ni.test(e);
}
function h1(e) {
  return Ye(Ni, e);
}
const Ci = /^fallback\(\) external(?:\s(?<stateMutability>payable{1}))?$/;
function A1(e) {
  return Ci.test(e);
}
function y1(e) {
  return Ye(Ci, e);
}
const w1 = /^receive\(\) external payable$/;
function T1(e) {
  return w1.test(e);
}
const v1 = /* @__PURE__ */ new Set(["indexed"]), Za = /* @__PURE__ */ new Set([
  "calldata",
  "memory",
  "storage"
]);
class I1 extends ue {
  constructor({ type: t }) {
    super("Unknown type.", {
      metaMessages: [
        `Type "${t}" is not a valid ABI type. Perhaps you forgot to include a struct signature?`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "UnknownTypeError"
    });
  }
}
class O1 extends ue {
  constructor({ type: t }) {
    super("Unknown type.", {
      metaMessages: [`Type "${t}" is not a valid ABI type.`]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "UnknownSolidityTypeError"
    });
  }
}
class E1 extends ue {
  constructor({ param: t }) {
    super("Invalid ABI parameter.", {
      details: t
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidParameterError"
    });
  }
}
class S1 extends ue {
  constructor({ param: t, name: n }) {
    super("Invalid ABI parameter.", {
      details: t,
      metaMessages: [
        `"${n}" is a protected Solidity keyword. More info: https://docs.soliditylang.org/en/latest/cheatsheet.html`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "SolidityProtectedKeywordError"
    });
  }
}
class k1 extends ue {
  constructor({ param: t, type: n, modifier: a }) {
    super("Invalid ABI parameter.", {
      details: t,
      metaMessages: [
        `Modifier "${a}" not allowed${n ? ` in "${n}" type` : ""}.`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidModifierError"
    });
  }
}
class N1 extends ue {
  constructor({ param: t, type: n, modifier: a }) {
    super("Invalid ABI parameter.", {
      details: t,
      metaMessages: [
        `Modifier "${a}" not allowed${n ? ` in "${n}" type` : ""}.`,
        `Data location can only be specified for array, struct, or mapping types, but "${a}" was given.`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidFunctionModifierError"
    });
  }
}
class C1 extends ue {
  constructor({ abiParameter: t }) {
    super("Invalid ABI parameter.", {
      details: JSON.stringify(t, null, 2),
      metaMessages: ["ABI parameter type is invalid."]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidAbiTypeParameterError"
    });
  }
}
class Lt extends ue {
  constructor({ signature: t, type: n }) {
    super(`Invalid ${n} signature.`, {
      details: t
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidSignatureError"
    });
  }
}
class x1 extends ue {
  constructor({ signature: t }) {
    super("Unknown signature.", {
      details: t
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "UnknownSignatureError"
    });
  }
}
class _1 extends ue {
  constructor({ signature: t }) {
    super("Invalid struct signature.", {
      details: t,
      metaMessages: ["No properties exist."]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidStructSignatureError"
    });
  }
}
class B1 extends ue {
  constructor({ type: t }) {
    super("Circular reference detected.", {
      metaMessages: [`Struct "${t}" is a circular reference.`]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "CircularReferenceError"
    });
  }
}
class j1 extends ue {
  constructor({ current: t, depth: n }) {
    super("Unbalanced parentheses.", {
      metaMessages: [
        `"${t.trim()}" has too many ${n > 0 ? "opening" : "closing"} parentheses.`
      ],
      details: `Depth "${n}"`
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidParenthesisError"
    });
  }
}
function M1(e, t, n) {
  let a = "";
  if (n)
    for (const s of Object.entries(n)) {
      if (!s)
        continue;
      let r = "";
      for (const i of s[1])
        r += `[${i.type}${i.name ? `:${i.name}` : ""}]`;
      a += `(${s[0]}{${r}})`;
    }
  return t ? `${t}:${e}${a}` : `${e}${a}`;
}
const Ta = /* @__PURE__ */ new Map([
  // Unnamed
  ["address", { type: "address" }],
  ["bool", { type: "bool" }],
  ["bytes", { type: "bytes" }],
  ["bytes32", { type: "bytes32" }],
  ["int", { type: "int256" }],
  ["int256", { type: "int256" }],
  ["string", { type: "string" }],
  ["uint", { type: "uint256" }],
  ["uint8", { type: "uint8" }],
  ["uint16", { type: "uint16" }],
  ["uint24", { type: "uint24" }],
  ["uint32", { type: "uint32" }],
  ["uint64", { type: "uint64" }],
  ["uint96", { type: "uint96" }],
  ["uint112", { type: "uint112" }],
  ["uint160", { type: "uint160" }],
  ["uint192", { type: "uint192" }],
  ["uint256", { type: "uint256" }],
  // Named
  ["address owner", { type: "address", name: "owner" }],
  ["address to", { type: "address", name: "to" }],
  ["bool approved", { type: "bool", name: "approved" }],
  ["bytes _data", { type: "bytes", name: "_data" }],
  ["bytes data", { type: "bytes", name: "data" }],
  ["bytes signature", { type: "bytes", name: "signature" }],
  ["bytes32 hash", { type: "bytes32", name: "hash" }],
  ["bytes32 r", { type: "bytes32", name: "r" }],
  ["bytes32 root", { type: "bytes32", name: "root" }],
  ["bytes32 s", { type: "bytes32", name: "s" }],
  ["string name", { type: "string", name: "name" }],
  ["string symbol", { type: "string", name: "symbol" }],
  ["string tokenURI", { type: "string", name: "tokenURI" }],
  ["uint tokenId", { type: "uint256", name: "tokenId" }],
  ["uint8 v", { type: "uint8", name: "v" }],
  ["uint256 balance", { type: "uint256", name: "balance" }],
  ["uint256 tokenId", { type: "uint256", name: "tokenId" }],
  ["uint256 value", { type: "uint256", name: "value" }],
  // Indexed
  [
    "event:address indexed from",
    { type: "address", name: "from", indexed: !0 }
  ],
  ["event:address indexed to", { type: "address", name: "to", indexed: !0 }],
  [
    "event:uint indexed tokenId",
    { type: "uint256", name: "tokenId", indexed: !0 }
  ],
  [
    "event:uint256 indexed tokenId",
    { type: "uint256", name: "tokenId", indexed: !0 }
  ]
]);
function R1(e, t = {}) {
  if (b1(e))
    return D1(e, t);
  if (u1(e))
    return U1(e, t);
  if (d1(e))
    return P1(e, t);
  if (g1(e))
    return V1(e, t);
  if (A1(e))
    return F1(e);
  if (T1(e))
    return {
      type: "receive",
      stateMutability: "payable"
    };
  throw new x1({ signature: e });
}
function D1(e, t = {}) {
  const n = p1(e);
  if (!n)
    throw new Lt({ signature: e, type: "function" });
  const a = me(n.parameters), s = [], r = a.length;
  for (let c = 0; c < r; c++)
    s.push(vt(a[c], {
      modifiers: Za,
      structs: t,
      type: "function"
    }));
  const i = [];
  if (n.returns) {
    const c = me(n.returns), o = c.length;
    for (let d = 0; d < o; d++)
      i.push(vt(c[d], {
        modifiers: Za,
        structs: t,
        type: "function"
      }));
  }
  return {
    name: n.name,
    type: "function",
    stateMutability: n.stateMutability ?? "nonpayable",
    inputs: s,
    outputs: i
  };
}
function U1(e, t = {}) {
  const n = l1(e);
  if (!n)
    throw new Lt({ signature: e, type: "event" });
  const a = me(n.parameters), s = [], r = a.length;
  for (let i = 0; i < r; i++)
    s.push(vt(a[i], {
      modifiers: v1,
      structs: t,
      type: "event"
    }));
  return { name: n.name, type: "event", inputs: s };
}
function P1(e, t = {}) {
  const n = f1(e);
  if (!n)
    throw new Lt({ signature: e, type: "error" });
  const a = me(n.parameters), s = [], r = a.length;
  for (let i = 0; i < r; i++)
    s.push(vt(a[i], { structs: t, type: "error" }));
  return { name: n.name, type: "error", inputs: s };
}
function V1(e, t = {}) {
  const n = h1(e);
  if (!n)
    throw new Lt({ signature: e, type: "constructor" });
  const a = me(n.parameters), s = [], r = a.length;
  for (let i = 0; i < r; i++)
    s.push(vt(a[i], { structs: t, type: "constructor" }));
  return {
    type: "constructor",
    stateMutability: n.stateMutability ?? "nonpayable",
    inputs: s
  };
}
function F1(e) {
  const t = y1(e);
  if (!t)
    throw new Lt({ signature: e, type: "fallback" });
  return {
    type: "fallback",
    stateMutability: t.stateMutability ?? "nonpayable"
  };
}
const $1 = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*(?:\spayable)?)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/, L1 = /^\((?<type>.+?)\)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/, z1 = /^u?int$/;
function vt(e, t) {
  var l, b;
  const n = M1(e, t == null ? void 0 : t.type, t == null ? void 0 : t.structs);
  if (Ta.has(n))
    return Ta.get(n);
  const a = vi.test(e), s = Ye(a ? L1 : $1, e);
  if (!s)
    throw new E1({ param: e });
  if (s.name && W1(s.name))
    throw new S1({ param: e, name: s.name });
  const r = s.name ? { name: s.name } : {}, i = s.modifier === "indexed" ? { indexed: !0 } : {}, c = (t == null ? void 0 : t.structs) ?? {};
  let o, d = {};
  if (a) {
    o = "tuple";
    const p = me(s.type), m = [], h = p.length;
    for (let y = 0; y < h; y++)
      m.push(vt(p[y], { structs: c }));
    d = { components: m };
  } else if (s.type in c)
    o = "tuple", d = { components: c[s.type] };
  else if (z1.test(s.type))
    o = `${s.type}256`;
  else if (s.type === "address payable")
    o = "address";
  else if (o = s.type, (t == null ? void 0 : t.type) !== "struct" && !xi(o))
    throw new O1({ type: o });
  if (s.modifier) {
    if (!((b = (l = t == null ? void 0 : t.modifiers) == null ? void 0 : l.has) != null && b.call(l, s.modifier)))
      throw new k1({
        param: e,
        type: t == null ? void 0 : t.type,
        modifier: s.modifier
      });
    if (Za.has(s.modifier) && !Q1(o, !!s.array))
      throw new N1({
        param: e,
        type: t == null ? void 0 : t.type,
        modifier: s.modifier
      });
  }
  const u = {
    type: `${o}${s.array ?? ""}`,
    ...r,
    ...i,
    ...d
  };
  return Ta.set(n, u), u;
}
function me(e, t = [], n = "", a = 0) {
  const s = e.trim().length;
  for (let r = 0; r < s; r++) {
    const i = e[r], c = e.slice(r + 1);
    switch (i) {
      case ",":
        return a === 0 ? me(c, [...t, n.trim()]) : me(c, t, `${n}${i}`, a);
      case "(":
        return me(c, t, `${n}${i}`, a + 1);
      case ")":
        return me(c, t, `${n}${i}`, a - 1);
      default:
        return me(c, t, `${n}${i}`, a);
    }
  }
  if (n === "")
    return t;
  if (a !== 0)
    throw new j1({ current: n, depth: a });
  return t.push(n.trim()), t;
}
function xi(e) {
  return e === "address" || e === "bool" || e === "function" || e === "string" || wi.test(e) || Ti.test(e);
}
const G1 = /^(?:after|alias|anonymous|apply|auto|byte|calldata|case|catch|constant|copyof|default|defined|error|event|external|false|final|function|immutable|implements|in|indexed|inline|internal|let|mapping|match|memory|mutable|null|of|override|partial|private|promise|public|pure|reference|relocatable|return|returns|sizeof|static|storage|struct|super|supports|switch|this|true|try|typedef|typeof|var|view|virtual)$/;
function W1(e) {
  return e === "address" || e === "bool" || e === "function" || e === "string" || e === "tuple" || wi.test(e) || Ti.test(e) || G1.test(e);
}
function Q1(e, t) {
  return t || e === "bytes" || e === "string" || e === "tuple";
}
function J1(e) {
  const t = {}, n = e.length;
  for (let i = 0; i < n; i++) {
    const c = e[i];
    if (!ki(c))
      continue;
    const o = m1(c);
    if (!o)
      throw new Lt({ signature: c, type: "struct" });
    const d = o.properties.split(";"), u = [], l = d.length;
    for (let b = 0; b < l; b++) {
      const m = d[b].trim();
      if (!m)
        continue;
      const h = vt(m, {
        type: "struct"
      });
      u.push(h);
    }
    if (!u.length)
      throw new _1({ signature: c });
    t[o.name] = u;
  }
  const a = {}, s = Object.entries(t), r = s.length;
  for (let i = 0; i < r; i++) {
    const [c, o] = s[i];
    a[c] = _i(o, t);
  }
  return a;
}
const Y1 = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*)(?<array>(?:\[\d*?\])+?)?$/;
function _i(e = [], t = {}, n = /* @__PURE__ */ new Set()) {
  const a = [], s = e.length;
  for (let r = 0; r < s; r++) {
    const i = e[r];
    if (vi.test(i.type))
      a.push(i);
    else {
      const o = Ye(Y1, i.type);
      if (!(o != null && o.type))
        throw new C1({ abiParameter: i });
      const { array: d, type: u } = o;
      if (u in t) {
        if (n.has(u))
          throw new B1({ type: u });
        a.push({
          ...i,
          type: `tuple${d ?? ""}`,
          components: _i(t[u], t, /* @__PURE__ */ new Set([...n, u]))
        });
      } else if (xi(u))
        a.push(i);
      else
        throw new I1({ type: u });
    }
  }
  return a;
}
function vs(e) {
  const t = J1(e), n = [], a = e.length;
  for (let s = 0; s < a; s++) {
    const r = e[s];
    ki(r) || n.push(R1(r, t));
  }
  return n;
}
function Ha(e, { includeName: t = !1 } = {}) {
  if (e.type !== "function" && e.type !== "event" && e.type !== "error")
    throw new ad(e.type);
  return `${e.name}(${Bi(e.inputs, { includeName: t })})`;
}
function Bi(e, { includeName: t = !1 } = {}) {
  return e ? e.map((n) => Z1(n, { includeName: t })).join(t ? ", " : ",") : "";
}
function Z1(e, { includeName: t }) {
  return e.type.startsWith("tuple") ? `(${Bi(e.components, { includeName: t })})${e.type.slice(5)}` : e.type + (t && e.name ? ` ${e.name}` : "");
}
function gn(e, { strict: t = !0 } = {}) {
  return !e || typeof e != "string" ? !1 : t ? /^0x[0-9a-fA-F]*$/.test(e) : e.startsWith("0x");
}
function oe(e) {
  return gn(e, { strict: !1 }) ? Math.ceil((e.length - 2) / 2) : e.length;
}
const ji = "2.56.3";
let Wt = {
  getDocsUrl: ({ docsBaseUrl: e, docsPath: t = "", docsSlug: n }) => t ? `${e ?? "https://viem.sh"}${t}${n ? `#${n}` : ""}` : void 0,
  version: `viem@${ji}`
};
class O0 extends Error {
  constructor(t, n = {}) {
    var c;
    const a = (() => {
      var o;
      return n.cause instanceof O0 ? n.cause.details : (o = n.cause) != null && o.message ? n.cause.message : n.details;
    })(), s = n.cause instanceof O0 && n.cause.docsPath || n.docsPath, r = (c = Wt.getDocsUrl) == null ? void 0 : c.call(Wt, { ...n, docsPath: s }), i = [
      t || "An error occurred.",
      "",
      ...n.metaMessages ? [...n.metaMessages, ""] : [],
      ...r ? [`Docs: ${r}`] : [],
      ...a ? [`Details: ${a}`] : [],
      ...Wt.version ? [`Version: ${Wt.version}`] : []
    ].join(`
`);
    super(i, n.cause ? { cause: n.cause } : void 0), Object.defineProperty(this, "details", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "docsPath", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "metaMessages", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "shortMessage", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "version", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "BaseError"
    }), this.details = a, this.docsPath = s, this.metaMessages = n.metaMessages, this.name = n.name ?? this.name, this.shortMessage = t, this.version = ji;
  }
  walk(t) {
    return Mi(this, t);
  }
}
function Mi(e, t) {
  return t != null && t(e) ? e : e && typeof e == "object" && "cause" in e && e.cause !== void 0 ? Mi(e.cause, t) : t ? null : e;
}
class H1 extends O0 {
  constructor({ docsPath: t }) {
    super([
      "A constructor was not found on the ABI.",
      "Make sure you are using the correct ABI and that the constructor exists on it."
    ].join(`
`), {
      docsPath: t,
      name: "AbiConstructorNotFoundError"
    });
  }
}
class ar extends O0 {
  constructor({ docsPath: t }) {
    super([
      "Constructor arguments were provided (`args`), but a constructor parameters (`inputs`) were not found on the ABI.",
      "Make sure you are using the correct ABI, and that the `inputs` attribute on the constructor exists."
    ].join(`
`), {
      docsPath: t,
      name: "AbiConstructorParamsNotFoundError"
    });
  }
}
class q1 extends O0 {
  constructor({ expectedLength: t, givenLength: n, type: a }) {
    super([
      `ABI encoding array length mismatch for type ${a}.`,
      `Expected length: ${t}`,
      `Given length: ${n}`
    ].join(`
`), { name: "AbiEncodingArrayLengthMismatchError" });
  }
}
class X1 extends O0 {
  constructor({ expectedSize: t, value: n }) {
    super(`Size of bytes "${n}" (bytes${oe(n)}) does not match expected size (bytes${t}).`, { name: "AbiEncodingBytesSizeMismatchError" });
  }
}
class Ri extends O0 {
  constructor({ expectedLength: t, givenLength: n }) {
    super([
      "ABI encoding params/values length mismatch.",
      `Expected length (params): ${t}`,
      `Given length (values): ${n}`
    ].join(`
`), { name: "AbiEncodingLengthMismatchError" });
  }
}
class sr extends O0 {
  constructor(t, { docsPath: n } = {}) {
    super([
      `Function ${t ? `"${t}" ` : ""}not found on ABI.`,
      "Make sure you are using the correct ABI and that the function exists on it."
    ].join(`
`), {
      docsPath: n,
      name: "AbiFunctionNotFoundError"
    });
  }
}
class K1 extends O0 {
  constructor(t, n) {
    super("Found ambiguous types in overloaded ABI items.", {
      metaMessages: [
        `\`${t.type}\` in \`${Ha(t.abiItem)}\`, and`,
        `\`${n.type}\` in \`${Ha(n.abiItem)}\``,
        "",
        "These types encode differently and cannot be distinguished at runtime.",
        "Remove one of the ambiguous items in the ABI."
      ],
      name: "AbiItemAmbiguityError"
    });
  }
}
class ed extends O0 {
  constructor({ expectedSize: t, givenSize: n }) {
    super(`Expected bytes${t}, got bytes${n}.`, {
      name: "BytesSizeMismatchError"
    });
  }
}
class td extends O0 {
  constructor(t, { docsPath: n }) {
    super([
      `Type "${t}" is not a valid encoding type.`,
      "Please provide a valid ABI type."
    ].join(`
`), { docsPath: n, name: "InvalidAbiEncodingType" });
  }
}
class nd extends O0 {
  constructor(t) {
    super([`Value "${t}" is not a valid array.`].join(`
`), {
      name: "InvalidArrayError"
    });
  }
}
class ad extends O0 {
  constructor(t) {
    super([
      `"${t}" is not a valid definition type.`,
      'Valid types: "function", "event", "error"'
    ].join(`
`), { name: "InvalidDefinitionTypeError" });
  }
}
class sd extends O0 {
  constructor(t) {
    super(`Type "${t}" is not supported for packed encoding.`, {
      name: "UnsupportedPackedAbiType"
    });
  }
}
class Di extends O0 {
  constructor({ offset: t, position: n, size: a }) {
    super(`Slice ${n === "start" ? "starting" : "ending"} at offset "${t}" is out-of-bounds (size: ${a}).`, { name: "SliceOffsetOutOfBoundsError" });
  }
}
class Ui extends O0 {
  constructor({ size: t, targetSize: n, type: a }) {
    super(`${a.charAt(0).toUpperCase()}${a.slice(1).toLowerCase()} size (${t}) exceeds padding size (${n}).`, { name: "SizeExceedsPaddingSizeError" });
  }
}
function Ge(e, { dir: t, size: n = 32 } = {}) {
  return typeof e == "string" ? st(e, { dir: t, size: n }) : rd(e, { dir: t, size: n });
}
function st(e, { dir: t, size: n = 32 } = {}) {
  if (n === null)
    return e;
  const a = e.replace("0x", "");
  if (a.length > n * 2)
    throw new Ui({
      size: Math.ceil(a.length / 2),
      targetSize: n,
      type: "hex"
    });
  return `0x${a[t === "right" ? "padEnd" : "padStart"](n * 2, "0")}`;
}
function rd(e, { dir: t, size: n = 32 } = {}) {
  if (n === null)
    return e;
  if (e.length > n)
    throw new Ui({
      size: e.length,
      targetSize: n,
      type: "bytes"
    });
  const a = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    const r = t === "right";
    a[r ? s : n - s - 1] = e[r ? s : e.length - s - 1];
  }
  return a;
}
class Pi extends O0 {
  constructor({ max: t, min: n, signed: a, size: s, value: r }) {
    super(`Number "${r}" is not in safe ${s ? `${s * 8}-bit ${a ? "signed" : "unsigned"} ` : ""}integer range ${t ? `(${n} to ${t})` : `(above ${n})`}`, { name: "IntegerOutOfRangeError" });
  }
}
class id extends O0 {
  constructor({ givenSize: t, maxSize: n }) {
    super(`Size cannot exceed ${n} bytes. Given size: ${t} bytes.`, { name: "SizeOverflowError" });
  }
}
function hn(e, { size: t }) {
  if (oe(e) > t)
    throw new id({
      givenSize: oe(e),
      maxSize: t
    });
}
const cd = /* @__PURE__ */ Array.from({ length: 256 }, (e, t) => t.toString(16).padStart(2, "0"));
function We(e, t = {}) {
  return typeof e == "number" || typeof e == "bigint" ? ut(e, t) : typeof e == "string" ? Os(e, t) : typeof e == "boolean" ? Is(e, t) : Vi(e, t);
}
function Is(e, t = {}) {
  const n = `0x${Number(e)}`;
  return typeof t.size == "number" ? (hn(n, { size: t.size }), Ge(n, { size: t.size })) : n;
}
function Vi(e, t = {}) {
  let n = "";
  for (let s = 0; s < e.length; s++)
    n += cd[e[s]];
  const a = `0x${n}`;
  return typeof t.size == "number" ? (hn(a, { size: t.size }), Ge(a, { dir: "right", size: t.size })) : a;
}
function ut(e, t = {}) {
  const { signed: n, size: a } = t, s = BigInt(e);
  let r;
  a ? n ? r = (1n << BigInt(a) * 8n - 1n) - 1n : r = 2n ** (BigInt(a) * 8n) - 1n : typeof e == "number" && (r = BigInt(Number.MAX_SAFE_INTEGER));
  const i = typeof r == "bigint" && n ? -r - 1n : 0;
  if (r && s > r || s < i) {
    const o = typeof e == "bigint" ? "n" : "";
    throw new Pi({
      max: r ? `${r}${o}` : void 0,
      min: `${i}${o}`,
      signed: n,
      size: a,
      value: `${e}${o}`
    });
  }
  const c = `0x${(n && s < 0 ? (1n << BigInt(a * 8)) + BigInt(s) : s).toString(16)}`;
  return a ? Ge(c, { size: a }) : c;
}
const od = /* @__PURE__ */ new TextEncoder();
function Os(e, t = {}) {
  const n = od.encode(e);
  return Vi(n, t);
}
const dd = /* @__PURE__ */ new TextEncoder();
function Fi(e, t = {}) {
  return typeof e == "number" || typeof e == "bigint" ? ud(e, t) : typeof e == "boolean" ? fd(e, t) : gn(e) ? $i(e, t) : Li(e, t);
}
function fd(e, t = {}) {
  const n = new Uint8Array(1);
  return n[0] = Number(e), typeof t.size == "number" ? (hn(n, { size: t.size }), Ge(n, { size: t.size })) : n;
}
const _e = {
  zero: 48,
  nine: 57,
  A: 65,
  F: 70,
  a: 97,
  f: 102
};
function rr(e) {
  if (e >= _e.zero && e <= _e.nine)
    return e - _e.zero;
  if (e >= _e.A && e <= _e.F)
    return e - (_e.A - 10);
  if (e >= _e.a && e <= _e.f)
    return e - (_e.a - 10);
}
function $i(e, t = {}) {
  let n = e;
  t.size && (hn(n, { size: t.size }), n = Ge(n, { dir: "right", size: t.size }));
  let a = n.slice(2);
  a.length % 2 && (a = `0${a}`);
  const s = a.length / 2, r = new Uint8Array(s);
  for (let i = 0, c = 0; i < s; i++) {
    const o = rr(a.charCodeAt(c++)), d = rr(a.charCodeAt(c++));
    if (o === void 0 || d === void 0)
      throw new O0(`Invalid byte sequence ("${a[c - 2]}${a[c - 1]}" in "${a}").`);
    r[i] = o * 16 + d;
  }
  return r;
}
function ud(e, t) {
  const n = ut(e, t);
  return $i(n);
}
function Li(e, t = {}) {
  const n = dd.encode(e);
  return typeof t.size == "number" ? (hn(n, { size: t.size }), Ge(n, { dir: "right", size: t.size })) : n;
}
const En = /* @__PURE__ */ BigInt(2 ** 32 - 1), ir = /* @__PURE__ */ BigInt(32);
function ld(e, t = !1) {
  return t ? { h: Number(e & En), l: Number(e >> ir & En) } : { h: Number(e >> ir & En) | 0, l: Number(e & En) | 0 };
}
function bd(e, t = !1) {
  const n = e.length;
  let a = new Uint32Array(n), s = new Uint32Array(n);
  for (let r = 0; r < n; r++) {
    const { h: i, l: c } = ld(e[r], t);
    [a[r], s[r]] = [i, c];
  }
  return [a, s];
}
const pd = (e, t, n) => e << n | t >>> 32 - n, md = (e, t, n) => t << n | e >>> 32 - n, gd = (e, t, n) => t << n - 32 | e >>> 64 - n, hd = (e, t, n) => e << n - 32 | t >>> 64 - n;
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function Ad(e) {
  return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array";
}
function cr(e) {
  if (!Number.isSafeInteger(e) || e < 0)
    throw new Error("positive integer expected, got " + e);
}
function Gn(e, ...t) {
  if (!Ad(e))
    throw new Error("Uint8Array expected");
  if (t.length > 0 && !t.includes(e.length))
    throw new Error("Uint8Array expected of length " + t + ", got length=" + e.length);
}
function or(e, t = !0) {
  if (e.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (t && e.finished)
    throw new Error("Hash#digest() has already been called");
}
function yd(e, t) {
  Gn(e);
  const n = t.outputLen;
  if (e.length < n)
    throw new Error("digestInto() expects output buffer of length at least " + n);
}
function wd(e) {
  return new Uint32Array(e.buffer, e.byteOffset, Math.floor(e.byteLength / 4));
}
function zi(...e) {
  for (let t = 0; t < e.length; t++)
    e[t].fill(0);
}
const Td = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
function vd(e) {
  return e << 24 & 4278190080 | e << 8 & 16711680 | e >>> 8 & 65280 | e >>> 24 & 255;
}
function Id(e) {
  for (let t = 0; t < e.length; t++)
    e[t] = vd(e[t]);
  return e;
}
const dr = Td ? (e) => e : Id;
function Od(e) {
  if (typeof e != "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(e));
}
function Gi(e) {
  return typeof e == "string" && (e = Od(e)), Gn(e), e;
}
class Ed {
}
function Sd(e) {
  const t = (a) => e().update(Gi(a)).digest(), n = e();
  return t.outputLen = n.outputLen, t.blockLen = n.blockLen, t.create = () => e(), t;
}
const kd = BigInt(0), Qt = BigInt(1), Nd = BigInt(2), Cd = BigInt(7), xd = BigInt(256), _d = BigInt(113), Wi = [], Qi = [], Ji = [];
for (let e = 0, t = Qt, n = 1, a = 0; e < 24; e++) {
  [n, a] = [a, (2 * n + 3 * a) % 5], Wi.push(2 * (5 * a + n)), Qi.push((e + 1) * (e + 2) / 2 % 64);
  let s = kd;
  for (let r = 0; r < 7; r++)
    t = (t << Qt ^ (t >> Cd) * _d) % xd, t & Nd && (s ^= Qt << (Qt << /* @__PURE__ */ BigInt(r)) - Qt);
  Ji.push(s);
}
const Yi = bd(Ji, !0), Bd = Yi[0], jd = Yi[1], fr = (e, t, n) => n > 32 ? gd(e, t, n) : pd(e, t, n), ur = (e, t, n) => n > 32 ? hd(e, t, n) : md(e, t, n);
function Md(e, t = 24) {
  const n = new Uint32Array(10);
  for (let a = 24 - t; a < 24; a++) {
    for (let i = 0; i < 10; i++)
      n[i] = e[i] ^ e[i + 10] ^ e[i + 20] ^ e[i + 30] ^ e[i + 40];
    for (let i = 0; i < 10; i += 2) {
      const c = (i + 8) % 10, o = (i + 2) % 10, d = n[o], u = n[o + 1], l = fr(d, u, 1) ^ n[c], b = ur(d, u, 1) ^ n[c + 1];
      for (let p = 0; p < 50; p += 10)
        e[i + p] ^= l, e[i + p + 1] ^= b;
    }
    let s = e[2], r = e[3];
    for (let i = 0; i < 24; i++) {
      const c = Qi[i], o = fr(s, r, c), d = ur(s, r, c), u = Wi[i];
      s = e[u], r = e[u + 1], e[u] = o, e[u + 1] = d;
    }
    for (let i = 0; i < 50; i += 10) {
      for (let c = 0; c < 10; c++)
        n[c] = e[i + c];
      for (let c = 0; c < 10; c++)
        e[i + c] ^= ~n[(c + 2) % 10] & n[(c + 4) % 10];
    }
    e[0] ^= Bd[a], e[1] ^= jd[a];
  }
  zi(n);
}
class Es extends Ed {
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(t, n, a, s = !1, r = 24) {
    if (super(), this.pos = 0, this.posOut = 0, this.finished = !1, this.destroyed = !1, this.enableXOF = !1, this.blockLen = t, this.suffix = n, this.outputLen = a, this.enableXOF = s, this.rounds = r, cr(a), !(0 < t && t < 200))
      throw new Error("only keccak-f1600 function is supported");
    this.state = new Uint8Array(200), this.state32 = wd(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    dr(this.state32), Md(this.state32, this.rounds), dr(this.state32), this.posOut = 0, this.pos = 0;
  }
  update(t) {
    or(this), t = Gi(t), Gn(t);
    const { blockLen: n, state: a } = this, s = t.length;
    for (let r = 0; r < s; ) {
      const i = Math.min(n - this.pos, s - r);
      for (let c = 0; c < i; c++)
        a[this.pos++] ^= t[r++];
      this.pos === n && this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = !0;
    const { state: t, suffix: n, pos: a, blockLen: s } = this;
    t[a] ^= n, n & 128 && a === s - 1 && this.keccak(), t[s - 1] ^= 128, this.keccak();
  }
  writeInto(t) {
    or(this, !1), Gn(t), this.finish();
    const n = this.state, { blockLen: a } = this;
    for (let s = 0, r = t.length; s < r; ) {
      this.posOut >= a && this.keccak();
      const i = Math.min(a - this.posOut, r - s);
      t.set(n.subarray(this.posOut, this.posOut + i), s), this.posOut += i, s += i;
    }
    return t;
  }
  xofInto(t) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(t);
  }
  xof(t) {
    return cr(t), this.xofInto(new Uint8Array(t));
  }
  digestInto(t) {
    if (yd(t, this), this.finished)
      throw new Error("digest() was already called");
    return this.writeInto(t), this.destroy(), t;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = !0, zi(this.state);
  }
  _cloneInto(t) {
    const { blockLen: n, suffix: a, outputLen: s, rounds: r, enableXOF: i } = this;
    return t || (t = new Es(n, a, s, i, r)), t.state32.set(this.state32), t.pos = this.pos, t.posOut = this.posOut, t.finished = this.finished, t.rounds = r, t.suffix = a, t.outputLen = s, t.enableXOF = i, t.destroyed = this.destroyed, t;
  }
}
const Rd = (e, t, n) => Sd(() => new Es(t, e, n)), Dd = Rd(1, 136, 256 / 8);
function An(e, t) {
  const n = t || "hex", a = Dd(gn(e, { strict: !1 }) ? Fi(e) : e);
  return n === "bytes" ? a : We(a);
}
const Ud = (e) => An(Fi(e));
function Pd(e) {
  return Ud(e);
}
function Vd(e) {
  let t = !0, n = "", a = 0, s = "", r = !1;
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (["(", ")", ","].includes(c) && (t = !0), c === "(" && a++, c === ")" && a--, !!t) {
      if (a === 0) {
        if (c === " " && ["event", "function", ""].includes(s))
          s = "";
        else if (s += c, c === ")") {
          r = !0;
          break;
        }
        continue;
      }
      if (c === " ") {
        e[i - 1] !== "," && n !== "," && n !== ",(" && (n = "", t = !1);
        continue;
      }
      s += c, n += c;
    }
  }
  if (!r)
    throw new O0("Unable to normalize signature.");
  return s;
}
const Fd = (e) => {
  const t = typeof e == "string" ? e : o1(e);
  return Vd(t);
};
function Zi(e) {
  return Pd(Fd(e));
}
const $d = Zi;
class Hi extends O0 {
  constructor({ address: t }) {
    super(`Address "${t}" is invalid.`, {
      metaMessages: [
        "- Address must be a hex value of 20 bytes (40 hex characters).",
        "- Address must match its checksum counterpart."
      ],
      name: "InvalidAddressError"
    });
  }
}
class qi extends Map {
  constructor(t) {
    super(), Object.defineProperty(this, "maxSize", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.maxSize = t;
  }
  get(t) {
    const n = super.get(t);
    return super.has(t) && (super.delete(t), super.set(t, n)), n;
  }
  set(t, n) {
    if (super.has(t) && super.delete(t), super.set(t, n), this.maxSize && this.size > this.maxSize) {
      const a = super.keys().next().value;
      a !== void 0 && super.delete(a);
    }
    return this;
  }
}
const va = /* @__PURE__ */ new qi(8192);
function Ld(e, t) {
  if (va.has(`${e}.${t}`))
    return va.get(`${e}.${t}`);
  const n = e.substring(2).toLowerCase(), a = An(Li(n), "bytes"), s = n.split("");
  for (let i = 0; i < 40; i += 2)
    a[i >> 1] >> 4 >= 8 && s[i] && (s[i] = s[i].toUpperCase()), (a[i >> 1] & 15) >= 8 && s[i + 1] && (s[i + 1] = s[i + 1].toUpperCase());
  const r = `0x${s.join("")}`;
  return va.set(`${e}.${t}`, r), r;
}
const zd = /^0x[a-fA-F0-9]{40}$/, Ia = /* @__PURE__ */ new qi(8192);
function sn(e, t) {
  const { strict: n = !0 } = t ?? {}, a = `${e}.${n}`;
  if (Ia.has(a))
    return Ia.get(a);
  const s = zd.test(e) ? e.toLowerCase() === e ? !0 : n ? Ld(e) === e : !0 : !1;
  return Ia.set(a, s), s;
}
function de(e) {
  return `0x${e.reduce((t, n) => t + n.replace("0x", ""), "")}`;
}
function Xi(e, t, n, { strict: a } = {}) {
  return gn(e, { strict: !1 }) ? Wd(e, t, n, {
    strict: a
  }) : Gd(e, t, n, {
    strict: a
  });
}
function Ki(e, t) {
  if (typeof t == "number" && t > 0 && t > oe(e) - 1)
    throw new Di({
      offset: t,
      position: "start",
      size: oe(e)
    });
}
function ec(e, t, n) {
  if (typeof t == "number" && typeof n == "number" && oe(e) !== n - t)
    throw new Di({
      offset: n,
      position: "end",
      size: oe(e)
    });
}
function Gd(e, t, n, { strict: a } = {}) {
  Ki(e, t);
  const s = e.slice(t, n);
  return a && ec(s, t, n), s;
}
function Wd(e, t, n, { strict: a } = {}) {
  Ki(e, t);
  const s = `0x${e.replace("0x", "").slice((t ?? 0) * 2, (n ?? e.length) * 2)}`;
  return a && ec(s, t, n), s;
}
const Qd = /^(.*)\[([0-9]*)\]$/, Jd = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/, tc = /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
function nc(e, t) {
  if (e.length !== t.length)
    throw new Ri({
      expectedLength: e.length,
      givenLength: t.length
    });
  const n = Yd({
    params: e,
    values: t
  });
  return ks(n);
}
function Yd({ params: e, values: t }) {
  const n = [];
  for (let a = 0; a < e.length; a++)
    n.push(Ss({ param: e[a], value: t[a] }));
  return n;
}
function Ss({ param: e, value: t }) {
  const n = ac(e.type);
  if (n) {
    const [a, s] = n;
    return Hd(t, { length: a, param: { ...e, type: s } });
  }
  if (e.type === "tuple")
    return tf(t, {
      param: e
    });
  if (e.type === "address")
    return Zd(t);
  if (e.type === "bool")
    return Xd(t);
  if (e.type.startsWith("uint") || e.type.startsWith("int")) {
    const a = e.type.startsWith("int"), [, , s = "256"] = tc.exec(e.type) ?? [];
    return Kd(t, {
      signed: a,
      size: Number(s)
    });
  }
  if (e.type.startsWith("bytes"))
    return qd(t, { param: e });
  if (e.type === "string")
    return ef(t);
  throw new td(e.type, {
    docsPath: "/docs/contract/encodeAbiParameters"
  });
}
function ks(e) {
  let t = 0;
  for (let r = 0; r < e.length; r++) {
    const { dynamic: i, encoded: c } = e[r];
    i ? t += 32 : t += oe(c);
  }
  const n = [], a = [];
  let s = 0;
  for (let r = 0; r < e.length; r++) {
    const { dynamic: i, encoded: c } = e[r];
    i ? (n.push(ut(t + s, { size: 32 })), a.push(c), s += oe(c)) : n.push(c);
  }
  return de([...n, ...a]);
}
function Zd(e) {
  if (!sn(e))
    throw new Hi({ address: e });
  return { dynamic: !1, encoded: st(e.toLowerCase()) };
}
function Hd(e, { length: t, param: n }) {
  const a = t === null;
  if (!Array.isArray(e))
    throw new nd(e);
  if (!a && e.length !== t)
    throw new q1({
      expectedLength: t,
      givenLength: e.length,
      type: `${n.type}[${t}]`
    });
  let s = e.length === 0 && qa(n);
  const r = [];
  for (let i = 0; i < e.length; i++) {
    const c = Ss({ param: n, value: e[i] });
    c.dynamic && (s = !0), r.push(c);
  }
  if (a || s) {
    const i = ks(r);
    if (a) {
      const c = ut(r.length, { size: 32 });
      return {
        dynamic: !0,
        encoded: de([c, i])
      };
    }
    if (s)
      return { dynamic: !0, encoded: i };
  }
  return {
    dynamic: !1,
    encoded: de(r.map(({ encoded: i }) => i))
  };
}
function qd(e, { param: t }) {
  const [, n] = t.type.split("bytes"), a = oe(e);
  if (!n) {
    let s = e;
    return a % 32 !== 0 && (s = st(s, {
      dir: "right",
      size: Math.ceil((e.length - 2) / 2 / 32) * 32
    })), {
      dynamic: !0,
      encoded: de([
        st(ut(a, { size: 32 })),
        s
      ])
    };
  }
  if (a !== Number.parseInt(n, 10))
    throw new X1({
      expectedSize: Number.parseInt(n, 10),
      value: e
    });
  return { dynamic: !1, encoded: st(e, { dir: "right" }) };
}
function Xd(e) {
  if (typeof e != "boolean")
    throw new O0(`Invalid boolean value: "${e}" (type: ${typeof e}). Expected: \`true\` or \`false\`.`);
  return { dynamic: !1, encoded: st(Is(e)) };
}
function Kd(e, { signed: t, size: n = 256 }) {
  if (typeof n == "number") {
    const a = 2n ** (BigInt(n) - (t ? 1n : 0n)) - 1n, s = t ? -a - 1n : 0n;
    if (e > a || e < s)
      throw new Pi({
        max: a.toString(),
        min: s.toString(),
        signed: t,
        size: n / 8,
        value: e.toString()
      });
  }
  return {
    dynamic: !1,
    encoded: ut(e, {
      size: 32,
      signed: t
    })
  };
}
function ef(e) {
  const t = Os(e), n = Math.ceil(oe(t) / 32), a = [];
  for (let s = 0; s < n; s++)
    a.push(st(Xi(t, s * 32, (s + 1) * 32), {
      dir: "right"
    }));
  return {
    dynamic: !0,
    encoded: de([
      st(ut(oe(t), { size: 32 })),
      ...a
    ])
  };
}
function tf(e, { param: t }) {
  let n = !1;
  const a = [];
  for (let s = 0; s < t.components.length; s++) {
    const r = t.components[s], i = Array.isArray(e) ? s : r.name, c = Ss({
      param: r,
      value: e[i]
    });
    a.push(c), c.dynamic && (n = !0);
  }
  return {
    dynamic: n,
    encoded: n ? ks(a) : de(a.map(({ encoded: s }) => s))
  };
}
function ac(e) {
  const t = e.match(/^(.*)\[(\d+)?\]$/);
  return t ? (
    // Return `null` if the array is dynamic.
    [t[2] ? Number(t[2]) : null, t[1]]
  ) : void 0;
}
function qa(e) {
  const { type: t } = e;
  if (t === "string" || t === "bytes" || t.endsWith("[]"))
    return !0;
  if (t === "tuple")
    return e.components.some(qa);
  const n = ac(t);
  return n ? qa({ ...e, type: n[1] }) : !1;
}
const sc = (e) => Xi(Zi(e), 0, 4);
function nf(e) {
  const { abi: t, args: n = [], name: a } = e, s = gn(a, { strict: !1 }), r = t.filter((c) => s ? c.type === "function" ? sc(c) === a : c.type === "event" ? $d(c) === a : !1 : "name" in c && c.name === a);
  if (r.length === 0)
    return;
  if (r.length === 1)
    return r[0];
  let i;
  for (const c of r) {
    if (!("inputs" in c))
      continue;
    if (!n || n.length === 0) {
      if (!c.inputs || c.inputs.length === 0)
        return c;
      continue;
    }
    if (!c.inputs || c.inputs.length === 0 || c.inputs.length !== n.length)
      continue;
    if (n.every((d, u) => {
      const l = "inputs" in c && c.inputs[u];
      return l ? Xa(d, l) : !1;
    })) {
      if (i && "inputs" in i && i.inputs) {
        const d = rc(c.inputs, i.inputs, n);
        if (d)
          throw new K1({
            abiItem: c,
            type: d[0]
          }, {
            abiItem: i,
            type: d[1]
          });
      }
      i = c;
    }
  }
  return i || r[0];
}
function Xa(e, t) {
  const n = typeof e, a = t.type;
  switch (a) {
    case "address":
      return sn(e, { strict: !1 });
    case "bool":
      return n === "boolean";
    case "function":
      return n === "string";
    case "string":
      return n === "string";
    default:
      return a === "tuple" && "components" in t ? Object.values(t.components).every((s, r) => n === "object" && Xa(Object.values(e)[r], s)) : /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(a) ? n === "number" || n === "bigint" : /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/.test(a) ? n === "string" || e instanceof Uint8Array : /[a-z]+[1-9]{0,3}(\[[0-9]{0,}\])+$/.test(a) ? Array.isArray(e) && e.every((s) => Xa(s, {
        ...t,
        // Pop off `[]` or `[M]` from end of type
        type: a.replace(/(\[[0-9]{0,}\])$/, "")
      })) : !1;
  }
}
function rc(e, t, n) {
  for (const a in e) {
    const s = e[a], r = t[a];
    if (s.type === "tuple" && r.type === "tuple" && "components" in s && "components" in r)
      return rc(s.components, r.components, n[a]);
    const i = [s.type, r.type];
    if (i.includes("address") && i.includes("bytes20") ? !0 : i.includes("address") && i.includes("string") ? sn(n[a], { strict: !1 }) : i.includes("address") && i.includes("bytes") ? sn(n[a], { strict: !1 }) : !1)
      return i;
  }
}
const lr = "/docs/contract/encodeFunctionData";
function af(e) {
  const { abi: t, args: n, functionName: a } = e;
  let s = t[0];
  if (a) {
    const r = nf({
      abi: t,
      args: n,
      name: a
    });
    if (!r)
      throw new sr(a, { docsPath: lr });
    s = r;
  }
  if (s.type !== "function")
    throw new sr(void 0, { docsPath: lr });
  return {
    abi: [s],
    functionName: sc(Ha(s))
  };
}
function yn(e) {
  const { args: t } = e, { abi: n, functionName: a } = (() => {
    var c;
    return e.abi.length === 1 && ((c = e.functionName) != null && c.startsWith("0x")) ? e : af(e);
  })(), s = n[0], r = a, i = "inputs" in s && s.inputs ? nc(s.inputs, t ?? []) : void 0;
  return de([r, i ?? "0x"]);
}
const Oa = "/docs/contract/encodeDeployData";
function ic(e) {
  const { abi: t, args: n, bytecode: a } = e;
  if (!n || n.length === 0)
    return a;
  const s = t.find((i) => "type" in i && i.type === "constructor");
  if (!s)
    throw new H1({ docsPath: Oa });
  if (!("inputs" in s))
    throw new ar({ docsPath: Oa });
  if (!s.inputs || s.inputs.length === 0)
    throw new ar({ docsPath: Oa });
  const r = nc(s.inputs, n);
  return de([a, r]);
}
function cc(e, t) {
  if (e.length !== t.length)
    throw new Ri({
      expectedLength: e.length,
      givenLength: t.length
    });
  const n = [];
  for (let a = 0; a < e.length; a++) {
    const s = e[a], r = t[a];
    n.push(oc(s, r));
  }
  return de(n);
}
function oc(e, t, n = !1) {
  if (e === "address") {
    const i = t;
    if (!sn(i))
      throw new Hi({ address: i });
    return Ge(i.toLowerCase(), {
      size: n ? 32 : null
    });
  }
  if (e === "string")
    return Os(t);
  if (e === "bytes")
    return t;
  if (e === "bool")
    return Ge(Is(t), { size: n ? 32 : 1 });
  const a = e.match(tc);
  if (a) {
    const [i, c, o = "256"] = a, d = Number.parseInt(o, 10) / 8;
    return ut(t, {
      size: n ? 32 : d,
      signed: c === "int"
    });
  }
  const s = e.match(Jd);
  if (s) {
    const [i, c] = s;
    if (Number.parseInt(c, 10) !== (t.length - 2) / 2)
      throw new ed({
        expectedSize: Number.parseInt(c, 10),
        givenSize: (t.length - 2) / 2
      });
    return Ge(t, { dir: "right", size: n ? 32 : null });
  }
  const r = e.match(Qd);
  if (r && Array.isArray(t)) {
    const [i, c] = r, o = [];
    for (let d = 0; d < t.length; d++)
      o.push(oc(c, t[d], !0));
    return o.length === 0 ? "0x" : de(o);
  }
  throw new sd(e);
}
const sf = "0x38", rf = "0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae", cf = "0x1d3da001E586a7DEFD397B77FADB29eD6F039c13", of = "0x55d398326f99059ff775485246999027b3197955", df = "0xc440f06bbc7e58b0d055815f915447e4ae0e3720", ff = "25000000000000000000", uf = "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba", lf = "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c", bf = {
  reset: {
    label: "Reset the existing USDT allowance to zero",
    to: "0x55d398326f99059ff775485246999027b3197955",
    data: "0x095ea7b30000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c130000000000000000000000000000000000000000000000000000000000000000",
    events: [
      {
        address: "0x55d398326f99059ff775485246999027b3197955",
        topics: [
          "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13"
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000000000000"
      }
    ]
  },
  approve: {
    label: "Approve exactly 25 USDT for the pilot pass",
    to: "0x55d398326f99059ff775485246999027b3197955",
    data: "0x095ea7b30000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c130000000000000000000000000000000000000000000000015af1d78b58c40000",
    events: [
      {
        address: "0x55d398326f99059ff775485246999027b3197955",
        topics: [
          "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13"
        ],
        data: "0x0000000000000000000000000000000000000000000000015af1d78b58c40000"
      }
    ]
  },
  buy: {
    label: "Buy the original-backed pass for 25 USDT",
    to: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
    data: "0xa6f2ae3a",
    events: [
      {
        address: "0x55d398326f99059ff775485246999027b3197955",
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x000000000000000000000000c440f06bbc7e58b0d055815f915447e4ae0e3720"
        ],
        data: "0x0000000000000000000000000000000000000000000000015af1d78b58c40000"
      },
      {
        address: "0x55d398326f99059ff775485246999027b3197955",
        topics: [
          "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13"
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000000000000"
      },
      {
        address: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
          "0x0000000000000000000000000000000000000000000000000000000000000001"
        ],
        data: "0x"
      },
      {
        address: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
        topics: [
          "0x4d81376e817f538bfc3647b67ca726bb2e4bd2cd7a79a7b5da522df6a15e2585",
          "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae"
        ],
        data: "0x0000000000000000000000000000000000000000000000015af1d78b58c40000"
      }
    ]
  }
}, De = {
  chainId: sf,
  from: rf,
  pass: cf,
  currency: of,
  treasury: df,
  price: ff,
  nft: uf,
  route: lf,
  steps: bf
}, pf = [
  {
    label: "Delegate",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0x587cde1e00000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab",
    before: "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
    after: "0x00000000000000000000000090f9c1c0c675a0ce9d539c540db7f4a1f7e583ae",
    changesAt: 0
  },
  {
    label: "Adapter pass",
    to: "0x90b5292a5074cfdd665c726b433cc0a97e0da6ab",
    data: "0xa7a1ed72",
    before: "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13",
    after: "0x0000000000000000000000001d3da001e586a7defd397b77fadb29ed6f039c13",
    changesAt: 0
  },
  {
    label: "Pass adapter",
    to: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
    data: "0x03eadcfc",
    before: "0x00000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab",
    after: "0x00000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab",
    changesAt: 0
  },
  {
    label: "Pass state",
    to: "0x1d3da001e586a7defd397b77fadb29ed6f039c13",
    data: "0xc19d93fb",
    before: "0x0000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 0
  },
  {
    label: "Send library",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0xb96a277f00000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000009f8c645f2d0b2159767bd6e0839de4be49e823de",
    after: "0x0000000000000000000000009f8c645f2d0b2159767bd6e0839de4be49e823de",
    changesAt: 0
  },
  {
    label: "Default send library flag",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0xdc93c8a200000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000001",
    after: "0x0000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 1
  },
  {
    label: "Receive library",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0x402f846800000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x000000000000000000000000b217266c3a98c8b2709ee26836c98cf12f6ccec10000000000000000000000000000000000000000000000000000000000000001",
    after: "0x000000000000000000000000b217266c3a98c8b2709ee26836c98cf12f6ccec10000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 2
  },
  {
    label: "Receive timeout",
    to: "0x1a44076050125825900e736c501f859c50fe728c",
    data: "0xef667aa100000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    after: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 0
  },
  {
    label: "Explicit send security",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x39e3f93800000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    after: "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000ff000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 3
  },
  {
    label: "Explicit receive security",
    to: "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1",
    data: "0x39e3f93800000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    after: "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000ff000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 4
  },
  {
    label: "Explicit executor",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x4d96320000000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    after: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    changesAt: 3
  },
  {
    label: "Effective send security",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x43ea4fa900000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 3
  },
  {
    label: "Effective receive security",
    to: "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1",
    data: "0x43ea4fa900000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 4
  },
  {
    label: "Effective executor",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x188183f400000000000000000000000090b5292a5074cfdd665c726b433cc0a97e0da6ab00000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    after: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    changesAt: 0
  },
  {
    label: "Protocol default Effective send security",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x43ea4fa9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 0
  },
  {
    label: "Protocol default Effective receive security",
    to: "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1",
    data: "0x43ea4fa9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    after: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000004000000000000000000000000247624e2143504730aec22912ed41f092498bef200000000000000000000000031f748a368a893bdb5abb67ec95f232507601a73000000000000000000000000fa9ba83c102283958b997adc8b44ed3a3cdb5dda000000000000000000000000fd6865c841c2d64565562fcc7e05e619a30615f00000000000000000000000000000000000000000000000000000000000000000",
    changesAt: 0
  },
  {
    label: "Protocol default Effective executor",
    to: "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE",
    data: "0x188183f4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000076aa",
    before: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    after: "0x00000000000000000000000000000000000000000000000000000000000027100000000000000000000000003ebd570ed38b1b3b4bc886999fcf507e9d584859",
    changesAt: 0
  }
], mf = {
  "0x1a44076050125825900e736c501f859c50fe728c": "c9f13bf2b27ee03740f83f4d52f1e6f65c2d930aa6fafb09358373edc7b2b039",
  "0x9F8C645f2D0b2159767Bd6E0839DE4BE49e823DE": "281e2b773062ba45ff33aab2a78d221667bafd036529d7cf651794404d7f93e2",
  "0xB217266c3A98C8B2709Ee26836C98cf12f6cCEC1": "eec1e49d8439c2863f169cfc6455fd8fdb30d916ec52387a9eb149dbc83cfd2c"
}, Wn = {
  reads: pf,
  code: mf
}, gf = {
  TreeSuitePass: {
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "verifier",
            type: "address"
          }
        ],
        stateMutability: "nonpayable",
        type: "constructor"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "sender",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          },
          {
            internalType: "address",
            name: "owner",
            type: "address"
          }
        ],
        name: "ERC721IncorrectOwner",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "operator",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "ERC721InsufficientApproval",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "approver",
            type: "address"
          }
        ],
        name: "ERC721InvalidApprover",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "operator",
            type: "address"
          }
        ],
        name: "ERC721InvalidOperator",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address"
          }
        ],
        name: "ERC721InvalidOwner",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "receiver",
            type: "address"
          }
        ],
        name: "ERC721InvalidReceiver",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "sender",
            type: "address"
          }
        ],
        name: "ERC721InvalidSender",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "ERC721NonexistentToken",
        type: "error"
      },
      {
        inputs: [],
        name: "Invalid",
        type: "error"
      },
      {
        inputs: [],
        name: "ReentrancyGuardReentrantCall",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "token",
            type: "address"
          }
        ],
        name: "SafeERC20FailedOperation",
        type: "error"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "length",
            type: "uint256"
          }
        ],
        name: "StringsInsufficientHexLength",
        type: "error"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "owner",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "address",
            name: "approved",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "Approval",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "owner",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "address",
            name: "operator",
            type: "address"
          },
          {
            indexed: !1,
            internalType: "bool",
            name: "approved",
            type: "bool"
          }
        ],
        name: "ApprovalForAll",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "buyer",
            type: "address"
          },
          {
            indexed: !1,
            internalType: "uint256",
            name: "amount",
            type: "uint256"
          }
        ],
        name: "PassPurchased",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !1,
            internalType: "bool",
            name: "paused",
            type: "bool"
          }
        ],
        name: "PurchasePauseChanged",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "request",
            type: "bytes32"
          }
        ],
        name: "RedemptionFinalized",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "request",
            type: "bytes32"
          },
          {
            indexed: !0,
            internalType: "bytes32",
            name: "nft",
            type: "bytes32"
          },
          {
            indexed: !1,
            internalType: "bytes32",
            name: "recipient",
            type: "bytes32"
          }
        ],
        name: "RedemptionRequested",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "route",
            type: "bytes32"
          },
          {
            indexed: !0,
            internalType: "bytes32",
            name: "nft",
            type: "bytes32"
          }
        ],
        name: "ReserveConfirmed",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            indexed: !0,
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "Transfer",
        type: "event"
      },
      {
        inputs: [],
        name: "PRICE",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "TOKEN_ID",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "sourceRoute",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "nft",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "request",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "suiRecipient",
            type: "bytes32"
          }
        ],
        name: "acknowledge",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "adapter",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "approve",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "backingNFT",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address"
          }
        ],
        name: "balanceOf",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "buy",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "wallet",
            type: "address"
          }
        ],
        name: "canPlay",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "sourceRoute",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "nft",
            type: "bytes32"
          }
        ],
        name: "confirmReserve",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "controller",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "currency",
        outputs: [
          {
            internalType: "contract IERC20",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "getApproved",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "initialBuyer",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address"
          },
          {
            internalType: "address",
            name: "operator",
            type: "address"
          }
        ],
        name: "isApprovedForAll",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "name",
        outputs: [
          {
            internalType: "string",
            name: "",
            type: "string"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "ownerOf",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "purchasesPaused",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "recipient",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemption",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "suiRecipient",
            type: "bytes32"
          }
        ],
        name: "requestRedemption",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "route",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "safeTransferFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes"
          }
        ],
        name: "safeTransferFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "operator",
            type: "address"
          },
          {
            internalType: "bool",
            name: "approved",
            type: "bool"
          }
        ],
        name: "setApprovalForAll",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bool",
            name: "paused",
            type: "bool"
          }
        ],
        name: "setPurchasesPaused",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "state",
        outputs: [
          {
            internalType: "enum TreeSuitePass.State",
            name: "",
            type: "uint8"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes4",
            name: "interfaceId",
            type: "bytes4"
          }
        ],
        name: "supportsInterface",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "symbol",
        outputs: [
          {
            internalType: "string",
            name: "",
            type: "string"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "tokenURI",
        outputs: [
          {
            internalType: "string",
            name: "",
            type: "string"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "from",
            type: "address"
          },
          {
            internalType: "address",
            name: "to",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256"
          }
        ],
        name: "transferFrom",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "treasury",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      }
    ],
    creationBytecode: "0x610100604052600a805460ff1916600117905534801561001d575f5ffd5b5060405161277338038061277383398101604081905261003c91610471565b6040518060600160405280602181526020016127526021913960408051808201909152600981526854524545504153533160b81b60208201525f6100808382610536565b50600161008d8282610536565b50506001600655504660381415806100b857507355d398326f99059ff775485246999027b31979553b155b806100cb57506001600160a01b0381163b155b8061014d57507355d398326f99059ff775485246999027b31979556001600160a01b031663313ce5676040518163ffffffff1660e01b8152600401602060405180830381865afa158015610121573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061014591906105f0565b60ff16601214155b1561016b57604051636dac6a0960e01b815260040160405180910390fd5b5f819050336001600160a01b0316816001600160a01b031663acba7b426040518163ffffffff1660e01b8152600401602060405180830381865afa1580156101b5573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906101d99190610471565b6001600160a01b03161415806102745750731a44076050125825900e736c501f859c50fe728c6001600160a01b0316816001600160a01b0316635e280f116040518163ffffffff1660e01b8152600401602060405180830381865afa158015610244573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906102689190610471565b6001600160a01b031614155b806102dc5750806001600160a01b03166315aff54e6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156102b6573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906102da9190610610565b155b806103445750806001600160a01b031663d96661ef6040518163ffffffff1660e01b8152600401602060405180830381865afa15801561031e573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906103429190610610565b155b806103d057507f046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba5f1b816001600160a01b03166378360c886040518163ffffffff1660e01b8152600401602060405180830381865afa1580156103a9573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906103cd9190610610565b14155b156103ee57604051636dac6a0960e01b815260040160405180910390fd5b6001600160a01b038083166080523360a081905260c0526040805163d96661ef60e01b815290519183169163d96661ef916004808201926020929091908290030181865afa158015610442573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104669190610610565b60e052506106279050565b5f60208284031215610481575f5ffd5b81516001600160a01b0381168114610497575f5ffd5b9392505050565b634e487b7160e01b5f52604160045260245ffd5b600181811c908216806104c657607f821691505b6020821081036104e457634e487b7160e01b5f52602260045260245ffd5b50919050565b601f82111561053157805f5260205f20601f840160051c8101602085101561050f5750805b601f840160051c820191505b8181101561052e575f815560010161051b565b50505b505050565b81516001600160401b0381111561054f5761054f61049e565b6105638161055d84546104b2565b846104ea565b6020601f821160018114610595575f831561057e5750848201515b5f19600385901b1c1916600184901b17845561052e565b5f84815260208120601f198516915b828110156105c457878501518255602094850194600190920191016105a4565b50848210156105e157868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b5f60208284031215610600575f5ffd5b815160ff81168114610497575f5ffd5b5f60208284031215610620575f5ffd5b5051919050565b60805160a05160c05160e0516120b96106995f395f818161043d0152818161067c0152818161096f015281816109f801528181610ae50152610e5501525f8181610492015261083101525f81816103410152610bf101525f818161021801528181610634015261092f01526120b95ff3fe608060405234801561000f575f5ffd5b50600436106101e7575f3560e01c806378360c8811610109578063b88d4fde1161009e578063d96661ef1161006e578063d96661ef14610438578063e5a6b10f1461045f578063e985e9c51461047a578063f77c47911461048d575f5ffd5b8063b88d4fde146103eb578063c19d93fb146103fe578063c87b56dd14610418578063c9f207151461042b575f5ffd5b806395d89b41116100d957806395d89b41146103b557806397579dd3146103bd578063a22cb465146103d0578063a6f2ae3a146103e3575f5ffd5b806378360c8814610376578063838c037d1461038a57806389a890021461039d5780638d859f3e146103a5575f5ffd5b8063325832ac1161017f5780636352211e1161014f5780636352211e1461032057806366d003ac146103335780636af7f9f51461033c57806370a0823114610363575f5ffd5b8063325832ac146102c857806342842e0e146102db5780635467e0a7146102ee57806361d027b314610305575f5ffd5b80630823d5f3116101ba5780630823d5f31461027a578063095ea7b31461028d57806314023905146102a257806323b872dd146102b5575f5ffd5b806301ffc9a7146101eb57806303eadcfc1461021357806306fdde0314610252578063081812fc14610267575b5f5ffd5b6101fe6101f936600461192a565b6104b4565b60405190151581526020015b60405180910390f35b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b03909116815260200161020a565b61025a610505565b60405161020a9190611992565b61023a6102753660046119a4565b610594565b6101fe6102883660046119d1565b6105bb565b6102a061029b3660046119ea565b61061a565b005b6102a06102b0366004611a12565b610629565b6102a06102c3366004611a41565b61079e565b6102a06102d6366004611a8a565b610826565b6102a06102e9366004611a41565b6108b6565b6102f760085481565b60405190815260200161020a565b61023a73c440f06bbc7e58b0d055815f915447e4ae0e372081565b61023a61032e3660046119a4565b6108d5565b6102f760095481565b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b6102f76103713660046119d1565b6108df565b6102f75f5160206120645f395f51905f5281565b6102a0610398366004611aa3565b610924565b6102f7600181565b6102f768015af1d78b58c4000081565b61025a610a41565b6102f76103cb3660046119a4565b610a50565b6102a06103de366004611ac3565b610ba5565b6102a0610bb0565b6102a06103f9366004611b08565b610e11565b60075461040b9060ff1681565b60405161020a9190611bf9565b61025a6104263660046119a4565b610e29565b600a546101fe9060ff1681565b6102f77f000000000000000000000000000000000000000000000000000000000000000081565b61023a7355d398326f99059ff775485246999027b319795581565b6101fe610488366004611c1f565b610ec6565b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b5f6001600160e01b031982166380ac58cd60e01b14806104e457506001600160e01b03198216635b5e139f60e01b145b806104ff57506301ffc9a760e01b6001600160e01b03198316145b92915050565b60605f805461051390611c47565b80601f016020809104026020016040519081016040528092919081815260200182805461053f90611c47565b801561058a5780601f106105615761010080835404028352916020019161058a565b820191905f5260205f20905b81548152906001019060200180831161056d57829003601f168201915b5050505050905090565b5f61059e82610ef3565b505f828152600460205260409020546001600160a01b03166104ff565b5f600260075460ff1660048111156105d5576105d5611be5565b1480156104ff57505060015f5260026020527fe90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2e0546001600160a01b0390811691161490565b610625828233610f2b565b5050565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461067257604051636dac6a0960e01b815260040160405180910390fd5b61067a610f38565b7f0000000000000000000000000000000000000000000000000000000000000000841415806106b657505f5160206120645f395f51905f528314155b806106bf575081155b806106cc57506008548214155b806106d957506009548114155b156106f757604051636dac6a0960e01b815260040160405180910390fd5b600460075460ff16600481111561071057610710611be5565b1461078e57600360075460ff16600481111561072e5761072e611be5565b1461074c57604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660041790556107636001610f62565b60405182907f33bf3780ab321f3c6eb7eba598dcd21e3989005d9e37e811e7182984e5a86865905f90a25b6107986001600655565b50505050565b6001600160a01b0382166107cc57604051633250574960e11b81525f60048201526024015b60405180910390fd5b5f6107d8838333610f9a565b9050836001600160a01b0316816001600160a01b031614610798576040516364283d7b60e01b81526001600160a01b03808616600483015260248201849052821660448201526064016107c3565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461086f57604051636dac6a0960e01b815260040160405180910390fd5b600a805460ff19168215159081179091556040519081527fd6d0fdd597c17a0211f0324826035a55dec84b1e6196f3585be220b46767fbb99060200160405180910390a150565b6108d083838360405180602001604052805f815250610e11565b505050565b5f6104ff82610ef3565b5f6001600160a01b038216610909576040516322718ad960e21b81525f60048201526024016107c3565b506001600160a01b03165f9081526003602052604090205490565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461096d57604051636dac6a0960e01b815260040160405180910390fd5b7f0000000000000000000000000000000000000000000000000000000000000000821415806109a957505f5160206120645f395f51905f528114155b156109c757604051636dac6a0960e01b815260040160405180910390fd5b5f60075460ff1660048111156109df576109df611be5565b03610625576007805460ff1916600117905560405181907f0000000000000000000000000000000000000000000000000000000000000000907fecf6c6e4df87a879d81225cf14697cca67eb2841ecbc03b2e97d9f71ea2008d4905f90a35050565b60606001805461051390611c47565b5f610a59610f38565b600260075460ff166004811115610a7257610a72611be5565b141580610a91575033610a8560016108d5565b6001600160a01b031614155b80610a9a575081155b15610ab857604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660031790556009829055604080516002602082015246918101919091523060608201527f000000000000000000000000000000000000000000000000000000000000000060808201525f5160206120645f395f51905f5260a0820152600160c08201523360e082015261010081018390526101200160408051808303601f1901815290829052805160209182012060088190558483525f5160206120645f395f51905f529290917fa71f7451e8d1e77318e5ba0935a7036781ceb676e25e961a567ec08b2b6b8bff910160405180910390a350600854610ba06001600655565b919050565b61062533838361101f565b610bb8610f38565b600160075460ff166004811115610bd157610bd1611be5565b141580610be05750600a5460ff165b80610c145750336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614155b15610c3257604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660021790556040516370a0823160e01b815273c440f06bbc7e58b0d055815f915447e4ae0e372060048201525f907355d398326f99059ff775485246999027b3197955906370a0823190602401602060405180830381865afa158015610ca2573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610cc69190611c7f565b9050610d057355d398326f99059ff775485246999027b31979553373c440f06bbc7e58b0d055815f915447e4ae0e372068015af1d78b58c400006110bd565b610d1868015af1d78b58c4000082611caa565b6040516370a0823160e01b815273c440f06bbc7e58b0d055815f915447e4ae0e372060048201527355d398326f99059ff775485246999027b3197955906370a0823190602401602060405180830381865afa158015610d79573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610d9d9190611c7f565b14610dbb57604051636dac6a0960e01b815260040160405180910390fd5b610dc6336001611117565b60405168015af1d78b58c40000815233907f4d81376e817f538bfc3647b67ca726bb2e4bd2cd7a79a7b5da522df6a15e25859060200160405180910390a250610e0f6001600655565b565b610e1c84848461079e565b6107983385858585611130565b6060610e3482610ef3565b50610ea0610e505f5160206120645f395f51905f526020611258565b610e7b7f00000000000000000000000000000000000000000000000000000000000000006020611258565b604051602001610e8c929190611cd8565b6040516020818303038152906040526113d2565b604051602001610eb09190611f29565b6040516020818303038152906040529050919050565b6001600160a01b039182165f90815260056020908152604080832093909416825291909152205460ff1690565b5f818152600260205260408120546001600160a01b0316806104ff57604051637e27328960e01b8152600481018490526024016107c3565b6108d083838360016113f8565b600260065403610f5b57604051633ee5aeb560e01b815260040160405180910390fd5b6002600655565b5f610f6e5f835f610f9a565b90506001600160a01b03811661062557604051637e27328960e01b8152600481018390526024016107c3565b5f600260075460ff166004811115610fb457610fb4611be5565b14158015610fec5750600460075460ff166004811115610fd657610fd6611be5565b148015610fea57506001600160a01b038416155b155b1561100a57604051636dac6a0960e01b815260040160405180910390fd5b6110158484846114fc565b90505b9392505050565b6001600160a01b03821661105157604051630b61174360e31b81526001600160a01b03831660048201526024016107c3565b6001600160a01b038381165f81815260056020908152604080832094871680845294825291829020805460ff191686151590811790915591519182527f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31910160405180910390a3505050565b604080516001600160a01b0385811660248301528416604482015260648082018490528251808303909101815260849091019091526020810180516001600160e01b03166323b872dd60e01b1790526107989085906115ee565b610625828260405180602001604052805f81525061165a565b6001600160a01b0383163b1561125157604051630a85bd0160e11b81526001600160a01b0384169063150b7a0290611172908890889087908790600401611f6d565b6020604051808303815f875af19250505080156111ac575060408051601f3d908101601f191682019092526111a991810190611fa9565b60015b611213573d8080156111d9576040519150601f19603f3d011682016040523d82523d5f602084013e6111de565b606091505b5080515f0361120b57604051633250574960e11b81526001600160a01b03851660048201526024016107c3565b805160208201fd5b6001600160e01b03198116630a85bd0160e11b1461124f57604051633250574960e11b81526001600160a01b03851660048201526024016107c3565b505b5050505050565b6060825f611267846002611fc4565b611272906002611caa565b67ffffffffffffffff81111561128a5761128a611af4565b6040519080825280601f01601f1916602001820160405280156112b4576020820181803683370190505b509050600360fc1b815f815181106112ce576112ce611fdb565b60200101906001600160f81b03191690815f1a905350600f60fb1b816001815181106112fc576112fc611fdb565b60200101906001600160f81b03191690815f1a9053505f61131e856002611fc4565b611329906001611caa565b90505b60018111156113a0576f181899199a1a9b1b9c1cb0b131b232b360811b83600f166010811061135d5761135d611fdb565b1a60f81b82828151811061137357611373611fdb565b60200101906001600160f81b03191690815f1a90535060049290921c9161139981611fef565b905061132c565b5081156113ca5760405163e22e27eb60e01b815260048101869052602481018590526044016107c3565b949350505050565b60606104ff82604051806060016040528060408152602001612024604091396001611671565b808061140c57506001600160a01b03821615155b156114cd575f61141b84610ef3565b90506001600160a01b038316158015906114475750826001600160a01b0316816001600160a01b031614155b801561145a57506114588184610ec6565b155b156114835760405163a9fbf51f60e01b81526001600160a01b03841660048201526024016107c3565b81156114cb5783856001600160a01b0316826001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45b505b50505f90815260046020526040902080546001600160a01b0319166001600160a01b0392909216919091179055565b5f828152600260205260408120546001600160a01b0390811690831615611528576115288184866117ec565b6001600160a01b03811615611562576115435f855f5f6113f8565b6001600160a01b0381165f90815260036020526040902080545f190190555b6001600160a01b03851615611590576001600160a01b0385165f908152600360205260409020805460010190555b5f8481526002602052604080822080546001600160a01b0319166001600160a01b0389811691821790925591518793918516917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef91a4949350505050565b5f5f60205f8451602086015f885af18061160d576040513d5f823e3d81fd5b50505f513d91508115611624578060011415611631565b6001600160a01b0384163b155b1561079857604051635274afe760e01b81526001600160a01b03851660048201526024016107c3565b6116648383611850565b6108d0335f858585611130565b606083515f0361168f575060408051602081019091525f8152611018565b5f826116bf576003855160046116a59190611fc4565b6116b0906002611caa565b6116ba9190612004565b6116e4565b6003855160026116cf9190611caa565b6116d99190612004565b6116e4906004611fc4565b90505f8167ffffffffffffffff81111561170057611700611af4565b6040519080825280601f01601f19166020018201604052801561172a576020820181803683370190505b509050600185016020820187885189016020810180515f82525b8284101561179f576003840193508351603f8160121c168701518653600186019550603f81600c1c168701518653600186019550603f8160061c168701518653600186019550603f8116870151865350600185019450611744565b9052505085156117e0576003885106600181146117c357600281146117d6576117de565b603d6001830353603d60028303536117de565b603d60018303535b505b50909695505050505050565b6117f78383836118b1565b6108d0576001600160a01b03831661182557604051637e27328960e01b8152600481018290526024016107c3565b60405163177e802f60e01b81526001600160a01b0383166004820152602481018290526044016107c3565b6001600160a01b03821661187957604051633250574960e11b81525f60048201526024016107c3565b5f61188583835f610f9a565b90506001600160a01b038116156108d0576040516339e3563760e11b81525f60048201526024016107c3565b5f6001600160a01b038316158015906110155750826001600160a01b0316846001600160a01b031614806118ea57506118ea8484610ec6565b806110155750505f908152600460205260409020546001600160a01b03908116911614919050565b6001600160e01b031981168114611927575f5ffd5b50565b5f6020828403121561193a575f5ffd5b813561101881611912565b5f5b8381101561195f578181015183820152602001611947565b50505f910152565b5f815180845261197e816020860160208601611945565b601f01601f19169290920160200192915050565b602081525f6110186020830184611967565b5f602082840312156119b4575f5ffd5b5035919050565b80356001600160a01b0381168114610ba0575f5ffd5b5f602082840312156119e1575f5ffd5b611018826119bb565b5f5f604083850312156119fb575f5ffd5b611a04836119bb565b946020939093013593505050565b5f5f5f5f60808587031215611a25575f5ffd5b5050823594602084013594506040840135936060013592509050565b5f5f5f60608486031215611a53575f5ffd5b611a5c846119bb565b9250611a6a602085016119bb565b929592945050506040919091013590565b80358015158114610ba0575f5ffd5b5f60208284031215611a9a575f5ffd5b61101882611a7b565b5f5f60408385031215611ab4575f5ffd5b50508035926020909101359150565b5f5f60408385031215611ad4575f5ffd5b611add836119bb565b9150611aeb60208401611a7b565b90509250929050565b634e487b7160e01b5f52604160045260245ffd5b5f5f5f5f60808587031215611b1b575f5ffd5b611b24856119bb565b9350611b32602086016119bb565b925060408501359150606085013567ffffffffffffffff811115611b54575f5ffd5b8501601f81018713611b64575f5ffd5b803567ffffffffffffffff811115611b7e57611b7e611af4565b604051601f8201601f19908116603f0116810167ffffffffffffffff81118282101715611bad57611bad611af4565b604052818152828201602001891015611bc4575f5ffd5b816020840160208301375f6020838301015280935050505092959194509250565b634e487b7160e01b5f52602160045260245ffd5b6020810160058310611c1957634e487b7160e01b5f52602160045260245ffd5b91905290565b5f5f60408385031215611c30575f5ffd5b611c39836119bb565b9150611aeb602084016119bb565b600181811c90821680611c5b57607f821691505b602082108103611c7957634e487b7160e01b5f52602260045260245ffd5b50919050565b5f60208284031215611c8f575f5ffd5b5051919050565b634e487b7160e01b5f52601160045260245ffd5b808201808211156104ff576104ff611c96565b5f8151611cce818560208601611945565b9290920192915050565b7f7b226e616d65223a22547265652041726361646520537569746520506173732081527f2d204e46547265652032373230222c226465736372697074696f6e223a22547260208201527f616e7366657261626c6520737569746520616363657373206261636b6564206260408201527f79206f726967696e616c20537569204e465472656520323732302e205265646560608201527f6d7074696f6e206c6f636b732074686973207061737320756e74696c2061757460808201527f68656e746963617465642072656c6561736520616e64207265746972656d656e60a0820152631d0b888b60e21b60c08201527f22696d616765223a2268747470733a2f2f626c61636b2d70657273697374656e60c48201527f742d63617079626172612d3237392e6d7970696e6174612e636c6f75642f697060e48201527f66732f62616679626569656f7a67766e72377163346768737133367a777373756101048201527f686a37786168757a6e6a6c6d7536673633636c6e79743337686a7369346d2f32610124820152680dcc8c0b9a9c19c88b60ba1b6101448201527f2265787465726e616c5f75726c223a2268747470733a2f2f747265652d746f6b61014d8201527f656e2e78797a2f706c61792f222c226261636b696e675f636861696e223a227361016d8201527f75693a6d61696e6e6574222c226261636b696e675f6e6674223a22000000000061018d8201525f611ef76101a8830185611cbd565b6a1116113937baba32911d1160a91b8152611f15600b820185611cbd565b61227d60f01b815260020195945050505050565b7f646174613a6170706c69636174696f6e2f6a736f6e3b6261736536342c00000081525f8251611f6081601d850160208701611945565b91909101601d0192915050565b6001600160a01b03858116825284166020820152604081018390526080606082018190525f90611f9f90830184611967565b9695505050505050565b5f60208284031215611fb9575f5ffd5b815161101881611912565b80820281158282048414176104ff576104ff611c96565b634e487b7160e01b5f52603260045260245ffd5b5f81611ffd57611ffd611c96565b505f190190565b5f8261201e57634e487b7160e01b5f52601260045260245ffd5b50049056fe4142434445464748494a4b4c4d4e4f505152535455565758595a6162636465666768696a6b6c6d6e6f707172737475767778797a303132333435363738392b2f046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6baa26469706673582212203ac6d98b05809f5934e421555a2e4d8d47c5624f10d057a7da03323ceab66a5f64736f6c634300081e00334e46547265652053756974652050617373202d204f6e65204e465420547269616c",
    runtimeTemplate: "0x608060405234801561000f575f5ffd5b50600436106101e7575f3560e01c806378360c8811610109578063b88d4fde1161009e578063d96661ef1161006e578063d96661ef14610438578063e5a6b10f1461045f578063e985e9c51461047a578063f77c47911461048d575f5ffd5b8063b88d4fde146103eb578063c19d93fb146103fe578063c87b56dd14610418578063c9f207151461042b575f5ffd5b806395d89b41116100d957806395d89b41146103b557806397579dd3146103bd578063a22cb465146103d0578063a6f2ae3a146103e3575f5ffd5b806378360c8814610376578063838c037d1461038a57806389a890021461039d5780638d859f3e146103a5575f5ffd5b8063325832ac1161017f5780636352211e1161014f5780636352211e1461032057806366d003ac146103335780636af7f9f51461033c57806370a0823114610363575f5ffd5b8063325832ac146102c857806342842e0e146102db5780635467e0a7146102ee57806361d027b314610305575f5ffd5b80630823d5f3116101ba5780630823d5f31461027a578063095ea7b31461028d57806314023905146102a257806323b872dd146102b5575f5ffd5b806301ffc9a7146101eb57806303eadcfc1461021357806306fdde0314610252578063081812fc14610267575b5f5ffd5b6101fe6101f936600461192a565b6104b4565b60405190151581526020015b60405180910390f35b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b03909116815260200161020a565b61025a610505565b60405161020a9190611992565b61023a6102753660046119a4565b610594565b6101fe6102883660046119d1565b6105bb565b6102a061029b3660046119ea565b61061a565b005b6102a06102b0366004611a12565b610629565b6102a06102c3366004611a41565b61079e565b6102a06102d6366004611a8a565b610826565b6102a06102e9366004611a41565b6108b6565b6102f760085481565b60405190815260200161020a565b61023a73c440f06bbc7e58b0d055815f915447e4ae0e372081565b61023a61032e3660046119a4565b6108d5565b6102f760095481565b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b6102f76103713660046119d1565b6108df565b6102f75f5160206120645f395f51905f5281565b6102a0610398366004611aa3565b610924565b6102f7600181565b6102f768015af1d78b58c4000081565b61025a610a41565b6102f76103cb3660046119a4565b610a50565b6102a06103de366004611ac3565b610ba5565b6102a0610bb0565b6102a06103f9366004611b08565b610e11565b60075461040b9060ff1681565b60405161020a9190611bf9565b61025a6104263660046119a4565b610e29565b600a546101fe9060ff1681565b6102f77f000000000000000000000000000000000000000000000000000000000000000081565b61023a7355d398326f99059ff775485246999027b319795581565b6101fe610488366004611c1f565b610ec6565b61023a7f000000000000000000000000000000000000000000000000000000000000000081565b5f6001600160e01b031982166380ac58cd60e01b14806104e457506001600160e01b03198216635b5e139f60e01b145b806104ff57506301ffc9a760e01b6001600160e01b03198316145b92915050565b60605f805461051390611c47565b80601f016020809104026020016040519081016040528092919081815260200182805461053f90611c47565b801561058a5780601f106105615761010080835404028352916020019161058a565b820191905f5260205f20905b81548152906001019060200180831161056d57829003601f168201915b5050505050905090565b5f61059e82610ef3565b505f828152600460205260409020546001600160a01b03166104ff565b5f600260075460ff1660048111156105d5576105d5611be5565b1480156104ff57505060015f5260026020527fe90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2e0546001600160a01b0390811691161490565b610625828233610f2b565b5050565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461067257604051636dac6a0960e01b815260040160405180910390fd5b61067a610f38565b7f0000000000000000000000000000000000000000000000000000000000000000841415806106b657505f5160206120645f395f51905f528314155b806106bf575081155b806106cc57506008548214155b806106d957506009548114155b156106f757604051636dac6a0960e01b815260040160405180910390fd5b600460075460ff16600481111561071057610710611be5565b1461078e57600360075460ff16600481111561072e5761072e611be5565b1461074c57604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660041790556107636001610f62565b60405182907f33bf3780ab321f3c6eb7eba598dcd21e3989005d9e37e811e7182984e5a86865905f90a25b6107986001600655565b50505050565b6001600160a01b0382166107cc57604051633250574960e11b81525f60048201526024015b60405180910390fd5b5f6107d8838333610f9a565b9050836001600160a01b0316816001600160a01b031614610798576040516364283d7b60e01b81526001600160a01b03808616600483015260248201849052821660448201526064016107c3565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461086f57604051636dac6a0960e01b815260040160405180910390fd5b600a805460ff19168215159081179091556040519081527fd6d0fdd597c17a0211f0324826035a55dec84b1e6196f3585be220b46767fbb99060200160405180910390a150565b6108d083838360405180602001604052805f815250610e11565b505050565b5f6104ff82610ef3565b5f6001600160a01b038216610909576040516322718ad960e21b81525f60048201526024016107c3565b506001600160a01b03165f9081526003602052604090205490565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461096d57604051636dac6a0960e01b815260040160405180910390fd5b7f0000000000000000000000000000000000000000000000000000000000000000821415806109a957505f5160206120645f395f51905f528114155b156109c757604051636dac6a0960e01b815260040160405180910390fd5b5f60075460ff1660048111156109df576109df611be5565b03610625576007805460ff1916600117905560405181907f0000000000000000000000000000000000000000000000000000000000000000907fecf6c6e4df87a879d81225cf14697cca67eb2841ecbc03b2e97d9f71ea2008d4905f90a35050565b60606001805461051390611c47565b5f610a59610f38565b600260075460ff166004811115610a7257610a72611be5565b141580610a91575033610a8560016108d5565b6001600160a01b031614155b80610a9a575081155b15610ab857604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660031790556009829055604080516002602082015246918101919091523060608201527f000000000000000000000000000000000000000000000000000000000000000060808201525f5160206120645f395f51905f5260a0820152600160c08201523360e082015261010081018390526101200160408051808303601f1901815290829052805160209182012060088190558483525f5160206120645f395f51905f529290917fa71f7451e8d1e77318e5ba0935a7036781ceb676e25e961a567ec08b2b6b8bff910160405180910390a350600854610ba06001600655565b919050565b61062533838361101f565b610bb8610f38565b600160075460ff166004811115610bd157610bd1611be5565b141580610be05750600a5460ff165b80610c145750336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614155b15610c3257604051636dac6a0960e01b815260040160405180910390fd5b6007805460ff191660021790556040516370a0823160e01b815273c440f06bbc7e58b0d055815f915447e4ae0e372060048201525f907355d398326f99059ff775485246999027b3197955906370a0823190602401602060405180830381865afa158015610ca2573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610cc69190611c7f565b9050610d057355d398326f99059ff775485246999027b31979553373c440f06bbc7e58b0d055815f915447e4ae0e372068015af1d78b58c400006110bd565b610d1868015af1d78b58c4000082611caa565b6040516370a0823160e01b815273c440f06bbc7e58b0d055815f915447e4ae0e372060048201527355d398326f99059ff775485246999027b3197955906370a0823190602401602060405180830381865afa158015610d79573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610d9d9190611c7f565b14610dbb57604051636dac6a0960e01b815260040160405180910390fd5b610dc6336001611117565b60405168015af1d78b58c40000815233907f4d81376e817f538bfc3647b67ca726bb2e4bd2cd7a79a7b5da522df6a15e25859060200160405180910390a250610e0f6001600655565b565b610e1c84848461079e565b6107983385858585611130565b6060610e3482610ef3565b50610ea0610e505f5160206120645f395f51905f526020611258565b610e7b7f00000000000000000000000000000000000000000000000000000000000000006020611258565b604051602001610e8c929190611cd8565b6040516020818303038152906040526113d2565b604051602001610eb09190611f29565b6040516020818303038152906040529050919050565b6001600160a01b039182165f90815260056020908152604080832093909416825291909152205460ff1690565b5f818152600260205260408120546001600160a01b0316806104ff57604051637e27328960e01b8152600481018490526024016107c3565b6108d083838360016113f8565b600260065403610f5b57604051633ee5aeb560e01b815260040160405180910390fd5b6002600655565b5f610f6e5f835f610f9a565b90506001600160a01b03811661062557604051637e27328960e01b8152600481018390526024016107c3565b5f600260075460ff166004811115610fb457610fb4611be5565b14158015610fec5750600460075460ff166004811115610fd657610fd6611be5565b148015610fea57506001600160a01b038416155b155b1561100a57604051636dac6a0960e01b815260040160405180910390fd5b6110158484846114fc565b90505b9392505050565b6001600160a01b03821661105157604051630b61174360e31b81526001600160a01b03831660048201526024016107c3565b6001600160a01b038381165f81815260056020908152604080832094871680845294825291829020805460ff191686151590811790915591519182527f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31910160405180910390a3505050565b604080516001600160a01b0385811660248301528416604482015260648082018490528251808303909101815260849091019091526020810180516001600160e01b03166323b872dd60e01b1790526107989085906115ee565b610625828260405180602001604052805f81525061165a565b6001600160a01b0383163b1561125157604051630a85bd0160e11b81526001600160a01b0384169063150b7a0290611172908890889087908790600401611f6d565b6020604051808303815f875af19250505080156111ac575060408051601f3d908101601f191682019092526111a991810190611fa9565b60015b611213573d8080156111d9576040519150601f19603f3d011682016040523d82523d5f602084013e6111de565b606091505b5080515f0361120b57604051633250574960e11b81526001600160a01b03851660048201526024016107c3565b805160208201fd5b6001600160e01b03198116630a85bd0160e11b1461124f57604051633250574960e11b81526001600160a01b03851660048201526024016107c3565b505b5050505050565b6060825f611267846002611fc4565b611272906002611caa565b67ffffffffffffffff81111561128a5761128a611af4565b6040519080825280601f01601f1916602001820160405280156112b4576020820181803683370190505b509050600360fc1b815f815181106112ce576112ce611fdb565b60200101906001600160f81b03191690815f1a905350600f60fb1b816001815181106112fc576112fc611fdb565b60200101906001600160f81b03191690815f1a9053505f61131e856002611fc4565b611329906001611caa565b90505b60018111156113a0576f181899199a1a9b1b9c1cb0b131b232b360811b83600f166010811061135d5761135d611fdb565b1a60f81b82828151811061137357611373611fdb565b60200101906001600160f81b03191690815f1a90535060049290921c9161139981611fef565b905061132c565b5081156113ca5760405163e22e27eb60e01b815260048101869052602481018590526044016107c3565b949350505050565b60606104ff82604051806060016040528060408152602001612024604091396001611671565b808061140c57506001600160a01b03821615155b156114cd575f61141b84610ef3565b90506001600160a01b038316158015906114475750826001600160a01b0316816001600160a01b031614155b801561145a57506114588184610ec6565b155b156114835760405163a9fbf51f60e01b81526001600160a01b03841660048201526024016107c3565b81156114cb5783856001600160a01b0316826001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45b505b50505f90815260046020526040902080546001600160a01b0319166001600160a01b0392909216919091179055565b5f828152600260205260408120546001600160a01b0390811690831615611528576115288184866117ec565b6001600160a01b03811615611562576115435f855f5f6113f8565b6001600160a01b0381165f90815260036020526040902080545f190190555b6001600160a01b03851615611590576001600160a01b0385165f908152600360205260409020805460010190555b5f8481526002602052604080822080546001600160a01b0319166001600160a01b0389811691821790925591518793918516917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef91a4949350505050565b5f5f60205f8451602086015f885af18061160d576040513d5f823e3d81fd5b50505f513d91508115611624578060011415611631565b6001600160a01b0384163b155b1561079857604051635274afe760e01b81526001600160a01b03851660048201526024016107c3565b6116648383611850565b6108d0335f858585611130565b606083515f0361168f575060408051602081019091525f8152611018565b5f826116bf576003855160046116a59190611fc4565b6116b0906002611caa565b6116ba9190612004565b6116e4565b6003855160026116cf9190611caa565b6116d99190612004565b6116e4906004611fc4565b90505f8167ffffffffffffffff81111561170057611700611af4565b6040519080825280601f01601f19166020018201604052801561172a576020820181803683370190505b509050600185016020820187885189016020810180515f82525b8284101561179f576003840193508351603f8160121c168701518653600186019550603f81600c1c168701518653600186019550603f8160061c168701518653600186019550603f8116870151865350600185019450611744565b9052505085156117e0576003885106600181146117c357600281146117d6576117de565b603d6001830353603d60028303536117de565b603d60018303535b505b50909695505050505050565b6117f78383836118b1565b6108d0576001600160a01b03831661182557604051637e27328960e01b8152600481018290526024016107c3565b60405163177e802f60e01b81526001600160a01b0383166004820152602481018290526044016107c3565b6001600160a01b03821661187957604051633250574960e11b81525f60048201526024016107c3565b5f61188583835f610f9a565b90506001600160a01b038116156108d0576040516339e3563760e11b81525f60048201526024016107c3565b5f6001600160a01b038316158015906110155750826001600160a01b0316846001600160a01b031614806118ea57506118ea8484610ec6565b806110155750505f908152600460205260409020546001600160a01b03908116911614919050565b6001600160e01b031981168114611927575f5ffd5b50565b5f6020828403121561193a575f5ffd5b813561101881611912565b5f5b8381101561195f578181015183820152602001611947565b50505f910152565b5f815180845261197e816020860160208601611945565b601f01601f19169290920160200192915050565b602081525f6110186020830184611967565b5f602082840312156119b4575f5ffd5b5035919050565b80356001600160a01b0381168114610ba0575f5ffd5b5f602082840312156119e1575f5ffd5b611018826119bb565b5f5f604083850312156119fb575f5ffd5b611a04836119bb565b946020939093013593505050565b5f5f5f5f60808587031215611a25575f5ffd5b5050823594602084013594506040840135936060013592509050565b5f5f5f60608486031215611a53575f5ffd5b611a5c846119bb565b9250611a6a602085016119bb565b929592945050506040919091013590565b80358015158114610ba0575f5ffd5b5f60208284031215611a9a575f5ffd5b61101882611a7b565b5f5f60408385031215611ab4575f5ffd5b50508035926020909101359150565b5f5f60408385031215611ad4575f5ffd5b611add836119bb565b9150611aeb60208401611a7b565b90509250929050565b634e487b7160e01b5f52604160045260245ffd5b5f5f5f5f60808587031215611b1b575f5ffd5b611b24856119bb565b9350611b32602086016119bb565b925060408501359150606085013567ffffffffffffffff811115611b54575f5ffd5b8501601f81018713611b64575f5ffd5b803567ffffffffffffffff811115611b7e57611b7e611af4565b604051601f8201601f19908116603f0116810167ffffffffffffffff81118282101715611bad57611bad611af4565b604052818152828201602001891015611bc4575f5ffd5b816020840160208301375f6020838301015280935050505092959194509250565b634e487b7160e01b5f52602160045260245ffd5b6020810160058310611c1957634e487b7160e01b5f52602160045260245ffd5b91905290565b5f5f60408385031215611c30575f5ffd5b611c39836119bb565b9150611aeb602084016119bb565b600181811c90821680611c5b57607f821691505b602082108103611c7957634e487b7160e01b5f52602260045260245ffd5b50919050565b5f60208284031215611c8f575f5ffd5b5051919050565b634e487b7160e01b5f52601160045260245ffd5b808201808211156104ff576104ff611c96565b5f8151611cce818560208601611945565b9290920192915050565b7f7b226e616d65223a22547265652041726361646520537569746520506173732081527f2d204e46547265652032373230222c226465736372697074696f6e223a22547260208201527f616e7366657261626c6520737569746520616363657373206261636b6564206260408201527f79206f726967696e616c20537569204e465472656520323732302e205265646560608201527f6d7074696f6e206c6f636b732074686973207061737320756e74696c2061757460808201527f68656e746963617465642072656c6561736520616e64207265746972656d656e60a0820152631d0b888b60e21b60c08201527f22696d616765223a2268747470733a2f2f626c61636b2d70657273697374656e60c48201527f742d63617079626172612d3237392e6d7970696e6174612e636c6f75642f697060e48201527f66732f62616679626569656f7a67766e72377163346768737133367a777373756101048201527f686a37786168757a6e6a6c6d7536673633636c6e79743337686a7369346d2f32610124820152680dcc8c0b9a9c19c88b60ba1b6101448201527f2265787465726e616c5f75726c223a2268747470733a2f2f747265652d746f6b61014d8201527f656e2e78797a2f706c61792f222c226261636b696e675f636861696e223a227361016d8201527f75693a6d61696e6e6574222c226261636b696e675f6e6674223a22000000000061018d8201525f611ef76101a8830185611cbd565b6a1116113937baba32911d1160a91b8152611f15600b820185611cbd565b61227d60f01b815260020195945050505050565b7f646174613a6170706c69636174696f6e2f6a736f6e3b6261736536342c00000081525f8251611f6081601d850160208701611945565b91909101601d0192915050565b6001600160a01b03858116825284166020820152604081018390526080606082018190525f90611f9f90830184611967565b9695505050505050565b5f60208284031215611fb9575f5ffd5b815161101881611912565b80820281158282048414176104ff576104ff611c96565b634e487b7160e01b5f52603260045260245ffd5b5f81611ffd57611ffd611c96565b505f190190565b5f8261201e57634e487b7160e01b5f52601260045260245ffd5b50049056fe4142434445464748494a4b4c4d4e4f505152535455565758595a6162636465666768696a6b6c6d6e6f707172737475767778797a303132333435363738392b2f046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6baa26469706673582212203ac6d98b05809f5934e421555a2e4d8d47c5624f10d057a7da03323ceab66a5f64736f6c634300081e0033",
    immutableReferences: {
      870: [
        {
          length: 32,
          start: 536
        },
        {
          length: 32,
          start: 1588
        },
        {
          length: 32,
          start: 2351
        }
      ],
      872: [
        {
          length: 32,
          start: 833
        },
        {
          length: 32,
          start: 3057
        }
      ],
      874: [
        {
          length: 32,
          start: 1170
        },
        {
          length: 32,
          start: 2097
        }
      ],
      876: [
        {
          length: 32,
          start: 1085
        },
        {
          length: 32,
          start: 1660
        },
        {
          length: 32,
          start: 2415
        },
        {
          length: 32,
          start: 2552
        },
        {
          length: 32,
          start: 2789
        },
        {
          length: 32,
          start: 3669
        }
      ]
    }
  },
  TreePassAdapter: {
    abi: [
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "peer",
            type: "bytes32"
          },
          {
            internalType: "bytes32",
            name: "routeId",
            type: "bytes32"
          }
        ],
        stateMutability: "nonpayable",
        type: "constructor"
      },
      {
        inputs: [],
        name: "Invalid",
        type: "error"
      },
      {
        inputs: [],
        name: "ReentrancyGuardReentrantCall",
        type: "error"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "guid",
            type: "bytes32"
          },
          {
            indexed: !1,
            internalType: "uint8",
            name: "kind",
            type: "uint8"
          }
        ],
        name: "MessageApplied",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "address",
            name: "pass",
            type: "address"
          }
        ],
        name: "PassBound",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !1,
            internalType: "uint128",
            name: "gas",
            type: "uint128"
          }
        ],
        name: "RedemptionGasRaised",
        type: "event"
      },
      {
        anonymous: !1,
        inputs: [
          {
            indexed: !0,
            internalType: "bytes32",
            name: "guid",
            type: "bytes32"
          },
          {
            indexed: !0,
            internalType: "bytes32",
            name: "request",
            type: "bytes32"
          }
        ],
        name: "RedemptionSent",
        type: "event"
      },
      {
        inputs: [],
        name: "SUI_EID",
        outputs: [
          {
            internalType: "uint32",
            name: "",
            type: "uint32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "uint32",
                name: "srcEid",
                type: "uint32"
              },
              {
                internalType: "bytes32",
                name: "sender",
                type: "bytes32"
              },
              {
                internalType: "uint64",
                name: "nonce",
                type: "uint64"
              }
            ],
            internalType: "struct Origin",
            name: "origin",
            type: "tuple"
          }
        ],
        name: "allowInitializePath",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "backingNFT",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "contract TreeSuitePass",
            name: "p",
            type: "address"
          }
        ],
        name: "bindPass",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "binder",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        name: "delivered",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "endpoint",
        outputs: [
          {
            internalType: "contract ILayerZeroEndpointV2",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "uint32",
                name: "srcEid",
                type: "uint32"
              },
              {
                internalType: "bytes32",
                name: "sender",
                type: "bytes32"
              },
              {
                internalType: "uint64",
                name: "nonce",
                type: "uint64"
              }
            ],
            internalType: "struct Origin",
            name: "origin",
            type: "tuple"
          },
          {
            internalType: "bytes32",
            name: "guid",
            type: "bytes32"
          },
          {
            internalType: "bytes",
            name: "message",
            type: "bytes"
          },
          {
            internalType: "address",
            name: "",
            type: "address"
          },
          {
            internalType: "bytes",
            name: "",
            type: "bytes"
          }
        ],
        name: "lzReceive",
        outputs: [],
        stateMutability: "payable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint32",
            name: "",
            type: "uint32"
          },
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        name: "nextNonce",
        outputs: [
          {
            internalType: "uint64",
            name: "",
            type: "uint64"
          }
        ],
        stateMutability: "pure",
        type: "function"
      },
      {
        inputs: [],
        name: "pass",
        outputs: [
          {
            internalType: "contract TreeSuitePass",
            name: "",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "quoteRedemption",
        outputs: [
          {
            components: [
              {
                internalType: "uint256",
                name: "nativeFee",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "lzTokenFee",
                type: "uint256"
              }
            ],
            internalType: "struct MessagingFee",
            name: "",
            type: "tuple"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionGas",
        outputs: [
          {
            internalType: "uint128",
            name: "",
            type: "uint128"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionGuid",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionOptions",
        outputs: [
          {
            internalType: "bytes",
            name: "",
            type: "bytes"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionPayload",
        outputs: [
          {
            internalType: "bytes",
            name: "",
            type: "bytes"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "redemptionSent",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "route",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      },
      {
        inputs: [],
        name: "sendRedemption",
        outputs: [
          {
            components: [
              {
                internalType: "bytes32",
                name: "guid",
                type: "bytes32"
              },
              {
                internalType: "uint64",
                name: "nonce",
                type: "uint64"
              },
              {
                components: [
                  {
                    internalType: "uint256",
                    name: "nativeFee",
                    type: "uint256"
                  },
                  {
                    internalType: "uint256",
                    name: "lzTokenFee",
                    type: "uint256"
                  }
                ],
                internalType: "struct MessagingFee",
                name: "fee",
                type: "tuple"
              }
            ],
            internalType: "struct MessagingReceipt",
            name: "receipt",
            type: "tuple"
          }
        ],
        stateMutability: "payable",
        type: "function"
      },
      {
        inputs: [
          {
            internalType: "uint128",
            name: "gas",
            type: "uint128"
          }
        ],
        name: "setRedemptionGas",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [],
        name: "suiPeer",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32"
          }
        ],
        stateMutability: "view",
        type: "function"
      }
    ],
    creationBytecode: "0x60e0604052600280546001600160801b0319166301c9c380179055348015610025575f5ffd5b50604051611c04380380611c048339810160408190526100449161019f565b60015f5546603814158061006b5750731a44076050125825900e736c501f859c50fe728c3b155b80610074575081155b8061007d575080155b80610109575061759663ffffffff16731a44076050125825900e736c501f859c50fe728c6001600160a01b031663416ecebf6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156100dc573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061010091906101c1565b63ffffffff1614155b1561012757604051636dac6a0960e01b815260040160405180910390fd5b608082905260a08190523360c081905260405163ca5eb5e160e01b81526004810191909152731a44076050125825900e736c501f859c50fe728c9063ca5eb5e1906024015f604051808303815f87803b158015610182575f5ffd5b505af1158015610194573d5f5f3e3d5ffd5b5050505050506101eb565b5f5f604083850312156101b0575f5ffd5b505080516020909101519092909150565b5f602082840312156101d1575f5ffd5b815163ffffffff811681146101e4575f5ffd5b9392505050565b60805160a05160c0516119a961025b5f395f818161030401528181610658015281816109490152610e6401525f81816103b301528181610501015281816107260152610bca01525f818161018e01528181610a8b01528181610f74015281816110c201526113c601526119a95ff3fe60806040526004361061011b575f3560e01c806383d5f21d1161009d578063ce26d6fe11610062578063ce26d6fe1461038d578063d96661ef146103a2578063e495f1d4146103d5578063eca463d414610400578063ff7bd03d14610414575f5ffd5b806383d5f21d146102aa578063a7a1ed72146102d4578063acba7b42146102f3578063b418b62214610326578063bbd6c9741461035d575f5ffd5b8063277e2bc6116100e3578063277e2bc6146101d35780634a8b412d146101f25780635e280f111461021357806378360c88146102525780637d25a05e14610272575f5ffd5b80630cd3c95b1461011f57806310265fa51461014957806313137d651461016a57806315aff54e1461017d57806323eba1c2146101be575b5f5ffd5b34801561012a575f5ffd5b50610133610433565b60405161014091906114b3565b60405180910390f35b348015610154575f5ffd5b506101686101633660046114e3565b61064d565b005b610168610178366004611559565b610a44565b348015610188575f5ffd5b506101b07f000000000000000000000000000000000000000000000000000000000000000081565b604051908152602001610140565b3480156101c9575f5ffd5b506101b060035481565b3480156101de575f5ffd5b506101686101ed3660046115f5565b610e59565b3480156101fd575f5ffd5b50610206610f25565b604051610140919061161b565b34801561021e575f5ffd5b5061023a731a44076050125825900e736c501f859c50fe728c81565b6040516001600160a01b039091168152602001610140565b34801561025d575f5ffd5b506101b05f5160206119545f395f51905f5281565b34801561027d575f5ffd5b5061029161028c366004611645565b61106e565b60405167ffffffffffffffff9091168152602001610140565b3480156102b5575f5ffd5b506102bf6176aa81565b60405163ffffffff9091168152602001610140565b3480156102df575f5ffd5b5060015461023a906001600160a01b031681565b3480156102fe575f5ffd5b5061023a7f000000000000000000000000000000000000000000000000000000000000000081565b348015610331575f5ffd5b50600254610345906001600160801b031681565b6040516001600160801b039091168152602001610140565b348015610368575f5ffd5b5060025461037d90600160801b900460ff1681565b6040519015158152602001610140565b610395611076565b604051610140919061166d565b3480156103ad575f5ffd5b506101b07f000000000000000000000000000000000000000000000000000000000000000081565b3480156103e0575f5ffd5b506101b06103ef3660046116af565b60046020525f908152604090205481565b34801561040b575f5ffd5b5061013361135a565b34801561041f575f5ffd5b5061037d61042e3660046116c6565b6113a5565b6001546060906001600160a01b031615806104c957506001546040805163c19d93fb60e01b815290516003926001600160a01b03169163c19d93fb9160048083019260209291908290030181865afa158015610491573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104b591906116f4565b60048111156104c6576104c66116e0565b14155b156104e757604051636dac6a0960e01b815260040160405180910390fd5b60015460408051635467e0a760e01b8152905160029283927f0000000000000000000000000000000000000000000000000000000000000000925f5160206119545f395f51905f52926001600160a01b031691635467e0a79160048083019260209291908290030181865afa158015610562573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105869190611712565b60015f9054906101000a90046001600160a01b03166001600160a01b03166366d003ac6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156105d6573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105fa9190611712565b6040516001600160f81b031960f897881b811660208301529590961b9094166021860152602285019290925260428401526062830152608282015260a2015b604051602081830303815290604052905090565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614158061068f57506001546001600160a01b031615155b806106a257506001600160a01b0381163b155b8061071e5750306001600160a01b0316816001600160a01b03166303eadcfc6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156106ee573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107129190611729565b6001600160a01b031614155b806107a857507f0000000000000000000000000000000000000000000000000000000000000000816001600160a01b031663d96661ef6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610781573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107a59190611712565b14155b8061082157505f5160206119545f395f51905f525f1b816001600160a01b03166378360c886040518163ffffffff1660e01b8152600401602060405180830381865afa1580156107fa573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061081e9190611712565b14155b806108b157507355d398326f99059ff775485246999027b31979556001600160a01b0316816001600160a01b031663e5a6b10f6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610881573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906108a59190611729565b6001600160a01b031614155b80610941575073c440f06bbc7e58b0d055815f915447e4ae0e37206001600160a01b0316816001600160a01b03166361d027b36040518163ffffffff1660e01b8152600401602060405180830381865afa158015610911573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906109359190611729565b6001600160a01b031614155b806109dd57507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316816001600160a01b031663f77c47916040518163ffffffff1660e01b8152600401602060405180830381865afa1580156109ad573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906109d19190611729565b6001600160a01b031614155b156109fb57604051636dac6a0960e01b815260040160405180910390fd5b600180546001600160a01b0319166001600160a01b0383169081179091556040517f3916d079df018feca66a550908f671cff67410227b4a8c24f13531847e12b9c8905f90a250565b610a4c611407565b33731a44076050125825900e736c501f859c50fe728c141580610a8357506176aa610a7a6020890189611744565b63ffffffff1614155b80610ab257507f0000000000000000000000000000000000000000000000000000000000000000876020013514155b80610ac657506001546001600160a01b0316155b80610acf575085155b80610ad957503415155b15610af757604051636dac6a0960e01b815260040160405180910390fd5b608284141580610b22575084845f818110610b1457610b1461175d565b9091013560f81c6002141590505b15610b4057604051636dac6a0960e01b815260040160405180910390fd5b5f85856001818110610b5457610b5461175d565b919091013560f81c91505f9050610b6f60226002888a611771565b610b7891611798565b90505f610b8960426022898b611771565b610b9291611798565b90505f610ba3606260428a8c611771565b610bac91611798565b90505f610bbd608260628b8d611771565b610bc691611798565b90507f000000000000000000000000000000000000000000000000000000000000000084141580610c0457505f5160206119545f395f51905f528314155b80610c6957508460ff16600114610c4a578460ff16600314610c27576001610c69565b610c3760608d0160408e016117ca565b67ffffffffffffffff1660021415610c69565b610c5a60608d0160408e016117ca565b67ffffffffffffffff16600114155b15610c8757604051636dac6a0960e01b815260040160405180910390fd5b5f8a8a604051610c989291906117e5565b60408051918290039091205f8e81526004602052919091205490915015610cf1575f8c8152600460205260409020548114610ce657604051636dac6a0960e01b815260040160405180910390fd5b505050505050610e47565b8560ff16600103610d8d5782151580610d0957508115155b15610d2757604051636dac6a0960e01b815260040160405180910390fd5b60015460405163838c037d60e01b815260048101879052602481018690526001600160a01b039091169063838c037d906044015b5f604051808303815f87803b158015610d72575f5ffd5b505af1158015610d84573d5f5f3e3d5ffd5b50505050610df7565b8560ff16600303610dde57600154604051631402390560e01b8152600481018790526024810186905260448101859052606481018490526001600160a01b0390911690631402390590608401610d5b565b604051636dac6a0960e01b815260040160405180910390fd5b5f8c815260046020908152604091829020839055905160ff881681528d917f176250b792ff8febc09040b8cf326ac55711559470d02712a12ae9a19a937cff910160405180910390a25050505050505b610e5060015f55565b50505050505050565b336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016141580610e9f57506002546001600160801b03908116908216105b80610eb35750600254600160801b900460ff165b15610ed157604051636dac6a0960e01b815260040160405180910390fd5b600280546001600160801b0319166001600160801b0383169081179091556040519081527f5421f9e2eb4b8dcb84b2372e7b4738e911e44f84c2969e270d4fe8ed9508bd839060200160405180910390a150565b604080518082019091525f8082526020820152600254600160801b900460ff1615610f6357604051636dac6a0960e01b815260040160405180910390fd5b6040805160a0810182526176aa81527f000000000000000000000000000000000000000000000000000000000000000060208201525f91731a44076050125825900e736c501f859c50fe728c9163ddc28c58918101610fc0610433565b8152602001610fcd61135a565b81525f6020909101526040516001600160e01b031960e084901b168152610ff9919030906004016117f4565b6040805180830381865afa158015611013573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061103791906118c5565b8051909150158061104b5750602081015115155b1561106957604051636dac6a0960e01b815260040160405180910390fd5b919050565b5f5b92915050565b61107e61142f565b611086611407565b600254600160801b900460ff16156110b157604051636dac6a0960e01b815260040160405180910390fd5b6040805160a0810182526176aa81527f000000000000000000000000000000000000000000000000000000000000000060208201525f9181016110f2610433565b81526020016110ff61135a565b81525f6020909101819052604051631bb8518b60e31b815291925090731a44076050125825900e736c501f859c50fe728c9063ddc28c589061114790859030906004016117f4565b6040805180830381865afa158015611161573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061118591906118c5565b805190915015806111995750602081015115155b806111a5575080513414155b156111c357604051636dac6a0960e01b815260040160405180910390fd5b6002805460ff60801b1916600160801b1790556040516302637a4560e41b8152731a44076050125825900e736c501f859c50fe728c90632637a45090349061121190869033906004016117f4565b60806040518083038185885af115801561122d573d5f5f3e3d5ffd5b50505050506040513d601f19601f8201168201806040525081019061125291906118df565b805190935015806112725750826020015167ffffffffffffffff16600114155b80611284575060408301516020015115155b80611293575060408301515134105b156112b157604051636dac6a0960e01b815260040160405180910390fd5b825160035560015460408051635467e0a760e01b815290516001600160a01b0390921691635467e0a7916004808201926020929091908290030181865afa1580156112fe573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906113229190611712565b83516040517fbe157cadcafc070b0baf6c5ad9a9e640a9ace6d1c96b5d1b1702286e16697477905f90a3505061135760015f55565b90565b600254604051600360f01b6020820152600160f81b60228201819052601160f01b6023830152602582015260809190911b6001600160801b0319166026820152606090603601610639565b5f6176aa6113b66020840184611744565b63ffffffff161480156113ec57507f00000000000000000000000000000000000000000000000000000000000000008260200135145b801561107057506001546001600160a01b0316151592915050565b60025f540361142957604051633ee5aeb560e01b815260040160405180910390fd5b60025f55565b60405180606001604052805f81526020015f67ffffffffffffffff16815260200161146b60405180604001604052805f81526020015f81525090565b905290565b5f81518084525f5b8181101561149457602081850181015186830182015201611478565b505f602082860101526020601f19601f83011685010191505092915050565b602081525f6114c56020830184611470565b9392505050565b6001600160a01b03811681146114e0575f5ffd5b50565b5f602082840312156114f3575f5ffd5b81356114c5816114cc565b5f6060828403121561150e575f5ffd5b50919050565b5f5f83601f840112611524575f5ffd5b50813567ffffffffffffffff81111561153b575f5ffd5b602083019150836020828501011115611552575f5ffd5b9250929050565b5f5f5f5f5f5f5f60e0888a03121561156f575f5ffd5b61157989896114fe565b965060608801359550608088013567ffffffffffffffff81111561159b575f5ffd5b6115a78a828b01611514565b90965094505060a08801356115bb816114cc565b925060c088013567ffffffffffffffff8111156115d6575f5ffd5b6115e28a828b01611514565b989b979a50959850939692959293505050565b5f60208284031215611605575f5ffd5b81356001600160801b03811681146114c5575f5ffd5b815181526020808301519082015260408101611070565b803563ffffffff81168114611069575f5ffd5b5f5f60408385031215611656575f5ffd5b61165f83611632565b946020939093013593505050565b5f6080820190508251825267ffffffffffffffff602084015116602083015260408301516116a8604084018280518252602090810151910152565b5092915050565b5f602082840312156116bf575f5ffd5b5035919050565b5f606082840312156116d6575f5ffd5b6114c583836114fe565b634e487b7160e01b5f52602160045260245ffd5b5f60208284031215611704575f5ffd5b8151600581106114c5575f5ffd5b5f60208284031215611722575f5ffd5b5051919050565b5f60208284031215611739575f5ffd5b81516114c5816114cc565b5f60208284031215611754575f5ffd5b6114c582611632565b634e487b7160e01b5f52603260045260245ffd5b5f5f8585111561177f575f5ffd5b8386111561178b575f5ffd5b5050820193919092039150565b80356020831015611070575f19602084900360031b1b1692915050565b67ffffffffffffffff811681146114e0575f5ffd5b5f602082840312156117da575f5ffd5b81356114c5816117b5565b818382375f9101908152919050565b6040815263ffffffff8351166040820152602083015160608201525f604084015160a0608084015261182960e0840182611470565b90506060850151603f198483030160a08501526118468282611470565b60809690960151151560c08501525050506001600160a01b039190911660209091015290565b5f6040828403121561187c575f5ffd5b6040805190810167ffffffffffffffff811182821017156118ab57634e487b7160e01b5f52604160045260245ffd5b604052825181526020928301519281019290925250919050565b5f604082840312156118d5575f5ffd5b6114c5838361186c565b5f60808284031280156118f0575f5ffd5b506040516060810167ffffffffffffffff8111828210171561192057634e487b7160e01b5f52604160045260245ffd5b604052825181526020830151611935816117b5565b6020820152611947846040850161186c565b6040820152939250505056fe046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6baa2646970667358221220f48aab856c9f5452bdabc498826f600f3cb80ff119a53ab662849ac52f01116464736f6c634300081e0033",
    runtimeTemplate: "0x60806040526004361061011b575f3560e01c806383d5f21d1161009d578063ce26d6fe11610062578063ce26d6fe1461038d578063d96661ef146103a2578063e495f1d4146103d5578063eca463d414610400578063ff7bd03d14610414575f5ffd5b806383d5f21d146102aa578063a7a1ed72146102d4578063acba7b42146102f3578063b418b62214610326578063bbd6c9741461035d575f5ffd5b8063277e2bc6116100e3578063277e2bc6146101d35780634a8b412d146101f25780635e280f111461021357806378360c88146102525780637d25a05e14610272575f5ffd5b80630cd3c95b1461011f57806310265fa51461014957806313137d651461016a57806315aff54e1461017d57806323eba1c2146101be575b5f5ffd5b34801561012a575f5ffd5b50610133610433565b60405161014091906114b3565b60405180910390f35b348015610154575f5ffd5b506101686101633660046114e3565b61064d565b005b610168610178366004611559565b610a44565b348015610188575f5ffd5b506101b07f000000000000000000000000000000000000000000000000000000000000000081565b604051908152602001610140565b3480156101c9575f5ffd5b506101b060035481565b3480156101de575f5ffd5b506101686101ed3660046115f5565b610e59565b3480156101fd575f5ffd5b50610206610f25565b604051610140919061161b565b34801561021e575f5ffd5b5061023a731a44076050125825900e736c501f859c50fe728c81565b6040516001600160a01b039091168152602001610140565b34801561025d575f5ffd5b506101b05f5160206119545f395f51905f5281565b34801561027d575f5ffd5b5061029161028c366004611645565b61106e565b60405167ffffffffffffffff9091168152602001610140565b3480156102b5575f5ffd5b506102bf6176aa81565b60405163ffffffff9091168152602001610140565b3480156102df575f5ffd5b5060015461023a906001600160a01b031681565b3480156102fe575f5ffd5b5061023a7f000000000000000000000000000000000000000000000000000000000000000081565b348015610331575f5ffd5b50600254610345906001600160801b031681565b6040516001600160801b039091168152602001610140565b348015610368575f5ffd5b5060025461037d90600160801b900460ff1681565b6040519015158152602001610140565b610395611076565b604051610140919061166d565b3480156103ad575f5ffd5b506101b07f000000000000000000000000000000000000000000000000000000000000000081565b3480156103e0575f5ffd5b506101b06103ef3660046116af565b60046020525f908152604090205481565b34801561040b575f5ffd5b5061013361135a565b34801561041f575f5ffd5b5061037d61042e3660046116c6565b6113a5565b6001546060906001600160a01b031615806104c957506001546040805163c19d93fb60e01b815290516003926001600160a01b03169163c19d93fb9160048083019260209291908290030181865afa158015610491573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104b591906116f4565b60048111156104c6576104c66116e0565b14155b156104e757604051636dac6a0960e01b815260040160405180910390fd5b60015460408051635467e0a760e01b8152905160029283927f0000000000000000000000000000000000000000000000000000000000000000925f5160206119545f395f51905f52926001600160a01b031691635467e0a79160048083019260209291908290030181865afa158015610562573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105869190611712565b60015f9054906101000a90046001600160a01b03166001600160a01b03166366d003ac6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156105d6573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105fa9190611712565b6040516001600160f81b031960f897881b811660208301529590961b9094166021860152602285019290925260428401526062830152608282015260a2015b604051602081830303815290604052905090565b336001600160a01b037f00000000000000000000000000000000000000000000000000000000000000001614158061068f57506001546001600160a01b031615155b806106a257506001600160a01b0381163b155b8061071e5750306001600160a01b0316816001600160a01b03166303eadcfc6040518163ffffffff1660e01b8152600401602060405180830381865afa1580156106ee573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107129190611729565b6001600160a01b031614155b806107a857507f0000000000000000000000000000000000000000000000000000000000000000816001600160a01b031663d96661ef6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610781573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107a59190611712565b14155b8061082157505f5160206119545f395f51905f525f1b816001600160a01b03166378360c886040518163ffffffff1660e01b8152600401602060405180830381865afa1580156107fa573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061081e9190611712565b14155b806108b157507355d398326f99059ff775485246999027b31979556001600160a01b0316816001600160a01b031663e5a6b10f6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610881573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906108a59190611729565b6001600160a01b031614155b80610941575073c440f06bbc7e58b0d055815f915447e4ae0e37206001600160a01b0316816001600160a01b03166361d027b36040518163ffffffff1660e01b8152600401602060405180830381865afa158015610911573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906109359190611729565b6001600160a01b031614155b806109dd57507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316816001600160a01b031663f77c47916040518163ffffffff1660e01b8152600401602060405180830381865afa1580156109ad573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906109d19190611729565b6001600160a01b031614155b156109fb57604051636dac6a0960e01b815260040160405180910390fd5b600180546001600160a01b0319166001600160a01b0383169081179091556040517f3916d079df018feca66a550908f671cff67410227b4a8c24f13531847e12b9c8905f90a250565b610a4c611407565b33731a44076050125825900e736c501f859c50fe728c141580610a8357506176aa610a7a6020890189611744565b63ffffffff1614155b80610ab257507f0000000000000000000000000000000000000000000000000000000000000000876020013514155b80610ac657506001546001600160a01b0316155b80610acf575085155b80610ad957503415155b15610af757604051636dac6a0960e01b815260040160405180910390fd5b608284141580610b22575084845f818110610b1457610b1461175d565b9091013560f81c6002141590505b15610b4057604051636dac6a0960e01b815260040160405180910390fd5b5f85856001818110610b5457610b5461175d565b919091013560f81c91505f9050610b6f60226002888a611771565b610b7891611798565b90505f610b8960426022898b611771565b610b9291611798565b90505f610ba3606260428a8c611771565b610bac91611798565b90505f610bbd608260628b8d611771565b610bc691611798565b90507f000000000000000000000000000000000000000000000000000000000000000084141580610c0457505f5160206119545f395f51905f528314155b80610c6957508460ff16600114610c4a578460ff16600314610c27576001610c69565b610c3760608d0160408e016117ca565b67ffffffffffffffff1660021415610c69565b610c5a60608d0160408e016117ca565b67ffffffffffffffff16600114155b15610c8757604051636dac6a0960e01b815260040160405180910390fd5b5f8a8a604051610c989291906117e5565b60408051918290039091205f8e81526004602052919091205490915015610cf1575f8c8152600460205260409020548114610ce657604051636dac6a0960e01b815260040160405180910390fd5b505050505050610e47565b8560ff16600103610d8d5782151580610d0957508115155b15610d2757604051636dac6a0960e01b815260040160405180910390fd5b60015460405163838c037d60e01b815260048101879052602481018690526001600160a01b039091169063838c037d906044015b5f604051808303815f87803b158015610d72575f5ffd5b505af1158015610d84573d5f5f3e3d5ffd5b50505050610df7565b8560ff16600303610dde57600154604051631402390560e01b8152600481018790526024810186905260448101859052606481018490526001600160a01b0390911690631402390590608401610d5b565b604051636dac6a0960e01b815260040160405180910390fd5b5f8c815260046020908152604091829020839055905160ff881681528d917f176250b792ff8febc09040b8cf326ac55711559470d02712a12ae9a19a937cff910160405180910390a25050505050505b610e5060015f55565b50505050505050565b336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016141580610e9f57506002546001600160801b03908116908216105b80610eb35750600254600160801b900460ff165b15610ed157604051636dac6a0960e01b815260040160405180910390fd5b600280546001600160801b0319166001600160801b0383169081179091556040519081527f5421f9e2eb4b8dcb84b2372e7b4738e911e44f84c2969e270d4fe8ed9508bd839060200160405180910390a150565b604080518082019091525f8082526020820152600254600160801b900460ff1615610f6357604051636dac6a0960e01b815260040160405180910390fd5b6040805160a0810182526176aa81527f000000000000000000000000000000000000000000000000000000000000000060208201525f91731a44076050125825900e736c501f859c50fe728c9163ddc28c58918101610fc0610433565b8152602001610fcd61135a565b81525f6020909101526040516001600160e01b031960e084901b168152610ff9919030906004016117f4565b6040805180830381865afa158015611013573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061103791906118c5565b8051909150158061104b5750602081015115155b1561106957604051636dac6a0960e01b815260040160405180910390fd5b919050565b5f5b92915050565b61107e61142f565b611086611407565b600254600160801b900460ff16156110b157604051636dac6a0960e01b815260040160405180910390fd5b6040805160a0810182526176aa81527f000000000000000000000000000000000000000000000000000000000000000060208201525f9181016110f2610433565b81526020016110ff61135a565b81525f6020909101819052604051631bb8518b60e31b815291925090731a44076050125825900e736c501f859c50fe728c9063ddc28c589061114790859030906004016117f4565b6040805180830381865afa158015611161573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061118591906118c5565b805190915015806111995750602081015115155b806111a5575080513414155b156111c357604051636dac6a0960e01b815260040160405180910390fd5b6002805460ff60801b1916600160801b1790556040516302637a4560e41b8152731a44076050125825900e736c501f859c50fe728c90632637a45090349061121190869033906004016117f4565b60806040518083038185885af115801561122d573d5f5f3e3d5ffd5b50505050506040513d601f19601f8201168201806040525081019061125291906118df565b805190935015806112725750826020015167ffffffffffffffff16600114155b80611284575060408301516020015115155b80611293575060408301515134105b156112b157604051636dac6a0960e01b815260040160405180910390fd5b825160035560015460408051635467e0a760e01b815290516001600160a01b0390921691635467e0a7916004808201926020929091908290030181865afa1580156112fe573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906113229190611712565b83516040517fbe157cadcafc070b0baf6c5ad9a9e640a9ace6d1c96b5d1b1702286e16697477905f90a3505061135760015f55565b90565b600254604051600360f01b6020820152600160f81b60228201819052601160f01b6023830152602582015260809190911b6001600160801b0319166026820152606090603601610639565b5f6176aa6113b66020840184611744565b63ffffffff161480156113ec57507f00000000000000000000000000000000000000000000000000000000000000008260200135145b801561107057506001546001600160a01b0316151592915050565b60025f540361142957604051633ee5aeb560e01b815260040160405180910390fd5b60025f55565b60405180606001604052805f81526020015f67ffffffffffffffff16815260200161146b60405180604001604052805f81526020015f81525090565b905290565b5f81518084525f5b8181101561149457602081850181015186830182015201611478565b505f602082860101526020601f19601f83011685010191505092915050565b602081525f6114c56020830184611470565b9392505050565b6001600160a01b03811681146114e0575f5ffd5b50565b5f602082840312156114f3575f5ffd5b81356114c5816114cc565b5f6060828403121561150e575f5ffd5b50919050565b5f5f83601f840112611524575f5ffd5b50813567ffffffffffffffff81111561153b575f5ffd5b602083019150836020828501011115611552575f5ffd5b9250929050565b5f5f5f5f5f5f5f60e0888a03121561156f575f5ffd5b61157989896114fe565b965060608801359550608088013567ffffffffffffffff81111561159b575f5ffd5b6115a78a828b01611514565b90965094505060a08801356115bb816114cc565b925060c088013567ffffffffffffffff8111156115d6575f5ffd5b6115e28a828b01611514565b989b979a50959850939692959293505050565b5f60208284031215611605575f5ffd5b81356001600160801b03811681146114c5575f5ffd5b815181526020808301519082015260408101611070565b803563ffffffff81168114611069575f5ffd5b5f5f60408385031215611656575f5ffd5b61165f83611632565b946020939093013593505050565b5f6080820190508251825267ffffffffffffffff602084015116602083015260408301516116a8604084018280518252602090810151910152565b5092915050565b5f602082840312156116bf575f5ffd5b5035919050565b5f606082840312156116d6575f5ffd5b6114c583836114fe565b634e487b7160e01b5f52602160045260245ffd5b5f60208284031215611704575f5ffd5b8151600581106114c5575f5ffd5b5f60208284031215611722575f5ffd5b5051919050565b5f60208284031215611739575f5ffd5b81516114c5816114cc565b5f60208284031215611754575f5ffd5b6114c582611632565b634e487b7160e01b5f52603260045260245ffd5b5f5f8585111561177f575f5ffd5b8386111561178b575f5ffd5b5050820193919092039150565b80356020831015611070575f19602084900360031b1b1692915050565b67ffffffffffffffff811681146114e0575f5ffd5b5f602082840312156117da575f5ffd5b81356114c5816117b5565b818382375f9101908152919050565b6040815263ffffffff8351166040820152602083015160608201525f604084015160a0608084015261182960e0840182611470565b90506060850151603f198483030160a08501526118468282611470565b60809690960151151560c08501525050506001600160a01b039190911660209091015290565b5f6040828403121561187c575f5ffd5b6040805190810167ffffffffffffffff811182821017156118ab57634e487b7160e01b5f52604160045260245ffd5b604052825181526020928301519281019290925250919050565b5f604082840312156118d5575f5ffd5b6114c5838361186c565b5f60808284031280156118f0575f5ffd5b506040516060810167ffffffffffffffff8111828210171561192057634e487b7160e01b5f52604160045260245ffd5b604052825181526020830151611935816117b5565b6020820152611947846040850161186c565b6040820152939250505056fe046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6baa2646970667358221220f48aab856c9f5452bdabc498826f600f3cb80ff119a53ab662849ac52f01116464736f6c634300081e0033",
    immutableReferences: {
      61: [
        {
          length: 32,
          start: 398
        },
        {
          length: 32,
          start: 2699
        },
        {
          length: 32,
          start: 3956
        },
        {
          length: 32,
          start: 4290
        },
        {
          length: 32,
          start: 5062
        }
      ],
      63: [
        {
          length: 32,
          start: 947
        },
        {
          length: 32,
          start: 1281
        },
        {
          length: 32,
          start: 1830
        },
        {
          length: 32,
          start: 3018
        }
      ],
      65: [
        {
          length: 32,
          start: 772
        },
        {
          length: 32,
          start: 1624
        },
        {
          length: 32,
          start: 2377
        },
        {
          length: 32,
          start: 3684
        }
      ]
    }
  }
}, ua = {
  contracts: gf
}, hf = "0x1d3da001E586a7DEFD397B77FADB29eD6F039c13", Af = "0xe969a6c0eba78468776b97d1e98cfc9e3f5b3d2cbd91903bee10de48d1e5e717", br = {
  bnbPass: hf,
  bnbPassDigest: Af
}, yf = "9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2", wf = "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4", Tf = "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba", vf = "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c", If = "0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab", Of = "AfupAmEkVCxA9uXWL6v42yopXtM6zpgt7dcYjx5Ei6QZ", Ef = "0x2bea9fd423d794de83f04c18381dc345ebf008d0a845a425ccb5c919beeca0ca", lt = {
  publicationDigest: yf,
  packagePeerIdentity: wf,
  nft: Tf,
  vault: vf,
  bnbAdapter: If,
  slotDigest: Of,
  bnbAdapterDigest: Ef
}, Sf = "0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae", kf = {
  from: Sf
}, Nf = "9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2", Cf = "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4", xf = "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba", _f = "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c", Bf = "AfupAmEkVCxA9uXWL6v42yopXtM6zpgt7dcYjx5Ei6QZ", Jt = {
  publicationDigest: Nf,
  packagePeerIdentity: Cf,
  nft: xf,
  vault: _f,
  slotDigest: Bf
}, jf = "0x90f9c1c0c675a0ce9d539c540db7f4a1f7e583ae", Mf = "0x1a44076050125825900e736c501f859c50fe728c", pr = {
  from: jf,
  endpoint: Mf
}, Rf = /^(?!.*(^(?!@)|[-.@])($|[-.@]))(?:[a-z0-9-]{0,63}(?:\.[a-z0-9-]{0,63})*)?@[a-z0-9-]{0,63}$/i, Df = /^(?!.*(^|[-.])($|[-.]))(?:[a-z0-9-]{0,63}\.)+sui$/i, Uf = 235;
function Pf(e) {
  return e.length > Uf ? !1 : e.includes("@") ? Rf.test(e) : Df.test(e);
}
const Vf = /^([a-z0-9]+(?:-[a-z0-9]+)*)$/, Ff = /^\d+$/, $f = 64, dc = "/", wn = (e) => {
  const t = e.split(dc);
  if (t.length < 2 || t.length > 3) return !1;
  const [n, a, s] = t;
  return s !== void 0 && !Ff.test(s) || !Pf(n) ? !1 : Vf.test(a) && a.length < $f;
}, Lf = (e) => {
  const t = e.split(/::|<|>|,/);
  for (const n of t) if (n.includes(dc) && !wn(n)) return !1;
  return mc(e);
};
function Qn(e) {
  let t = BigInt(e);
  const n = [];
  let a = 0;
  if (t === 0n) return [0];
  for (; t > 0; )
    n[a] = Number(t & 127n), t >>= 7n, t > 0n && (n[a] |= 128), a += 1;
  return n;
}
function zf(e) {
  let t = 0n, n = 0n, a = 0;
  for (; ; ) {
    if (a >= e.length) throw new Error("ULEB decode error: buffer overflow");
    const s = e[a];
    if (a += 1, t += BigInt(s & 127) << n, !(s & 128)) break;
    n += 7n;
  }
  if (t > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("ULEB decode error: value exceeds MAX_SAFE_INTEGER");
  return {
    value: Number(t),
    length: a
  };
}
var Gf = class {
  /**
  * @param {Uint8Array} data Data to use as a buffer.
  */
  constructor(e) {
    this.bytePosition = 0, this.dataView = new DataView(e.buffer, e.byteOffset, e.byteLength);
  }
  /**
  * Shift current cursor position by `bytes`.
  *
  * @param {Number} bytes Number of bytes to
  * @returns {this} Self for possible chaining.
  */
  shift(e) {
    return this.bytePosition += e, this;
  }
  /**
  * Read U8 value from the buffer and shift cursor by 1.
  * @returns
  */
  read8() {
    const e = this.dataView.getUint8(this.bytePosition);
    return this.shift(1), e;
  }
  /**
  * Read U16 value from the buffer and shift cursor by 2.
  * @returns
  */
  read16() {
    const e = this.dataView.getUint16(this.bytePosition, !0);
    return this.shift(2), e;
  }
  /**
  * Read U32 value from the buffer and shift cursor by 4.
  * @returns
  */
  read32() {
    const e = this.dataView.getUint32(this.bytePosition, !0);
    return this.shift(4), e;
  }
  /**
  * Read U64 value from the buffer and shift cursor by 8.
  * @returns
  */
  read64() {
    const e = this.read32(), t = this.read32().toString(16) + e.toString(16).padStart(8, "0");
    return BigInt("0x" + t).toString(10);
  }
  /**
  * Read U128 value from the buffer and shift cursor by 16.
  */
  read128() {
    const e = BigInt(this.read64()), t = BigInt(this.read64()).toString(16) + e.toString(16).padStart(16, "0");
    return BigInt("0x" + t).toString(10);
  }
  /**
  * Read U128 value from the buffer and shift cursor by 32.
  * @returns
  */
  read256() {
    const e = BigInt(this.read128()), t = BigInt(this.read128()).toString(16) + e.toString(16).padStart(32, "0");
    return BigInt("0x" + t).toString(10);
  }
  /**
  * Read `num` number of bytes from the buffer and shift cursor by `num`.
  * @param num Number of bytes to read.
  */
  readBytes(e) {
    const t = this.bytePosition + this.dataView.byteOffset, n = new Uint8Array(this.dataView.buffer, t, e);
    return this.shift(e), n;
  }
  /**
  * Read ULEB value - an integer of varying size. Used for enum indexes and
  * vector lengths.
  * @returns {Number} The ULEB value.
  */
  readULEB() {
    const e = this.bytePosition + this.dataView.byteOffset, { value: t, length: n } = zf(new Uint8Array(this.dataView.buffer, e));
    return this.shift(n), t;
  }
  /**
  * Read a BCS vector: read a length and then apply function `cb` X times
  * where X is the length of the vector, defined as ULEB in BCS bytes.
  * @param cb Callback to process elements of vector.
  * @returns {Array<Any>} Array of the resulting values, returned by callback.
  */
  readVec(e) {
    const t = this.readULEB(), n = [];
    for (let a = 0; a < t; a++) n.push(e(this, a, t));
    return n;
  }
};
/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const Wf = (e) => Object.freeze(e());
function Qf(e) {
  return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in e && e.BYTES_PER_ELEMENT === 1;
}
function mr(e) {
  if (!Qf(e))
    throw new TypeError("Uint8Array expected");
}
function Jf(e, t) {
  if (typeof t != "string")
    throw new TypeError(`${e}: string expected`);
  return !0;
}
function Yf(...e) {
  const t = (r) => r, n = (r, i) => (c) => r(i(c)), a = e.map((r) => r.encode).reduceRight(n, t), s = e.map((r) => r.decode).reduce(n, t);
  return { encode: a, decode: s };
}
const gr = /* @__PURE__ */ (() => {
  try {
    const e = new TextDecoder();
    return e.decode(Uint8Array.of(65, 48, 43, 127)) === "A0+" ? e : void 0;
  } catch {
    return;
  }
})(), Ea = 8192;
function Zf(e) {
  const t = e.length;
  if (gr !== void 0 && t >= 12)
    return gr.decode(e);
  if (t <= Ea)
    return String.fromCharCode.apply(null, e);
  let n = "";
  for (let a = 0; a < t; a += Ea)
    n += String.fromCharCode.apply(null, e.subarray(a, a + Ea));
  return n;
}
function Hf(e, t) {
  const n = e.length;
  if (n > 128)
    throw new Error("alphabet: max 128 letters");
  const a = new Uint8Array(n), s = new Int8Array(128).fill(-1);
  for (let r = 0; r < n; r++) {
    const i = e.charCodeAt(r);
    if (e.codePointAt(r) !== i || i > 127)
      throw new Error("alphabet: single-char ASCII letters only");
    a[r] = i, s[i] = r;
  }
  if (t !== void 0)
    for (const r of Object.keys(t)) {
      const i = r.charCodeAt(0), c = s[t[r].charCodeAt(0)];
      if (r.length !== 1 || i > 127 || c === void 0 || c === -1)
        throw new Error(`alphabet: invalid alias ${r}`);
      s[i] = c;
    }
  return {
    encode: (r) => {
      const i = new Uint8Array(r.length);
      for (let c = 0; c < r.length; c++) {
        const o = r[c], d = a[o];
        if (d === void 0)
          throw new Error(`alphabet.encode: invalid digit ${o}`);
        i[c] = d;
      }
      return Zf(i);
    },
    decode: (r) => {
      Jf("decode", r);
      const i = r.length, c = new Uint8Array(i);
      for (let o = 0; o < i; o++) {
        const d = r.charCodeAt(o), u = d < 128 ? s[d] : -1;
        if (u === -1)
          throw new Error(`Unknown letter "${r[o]}". Allowed: ${e}`);
        c[o] = u;
      }
      return c;
    }
  };
}
const hr = 656356768, qf = {
  encode: (e) => {
    mr(e);
    const t = e.length;
    if (t === 0)
      return new Uint8Array(0);
    let n = 0;
    for (; n < t - 1 && e[n] === 0; )
      n++;
    const a = Math.ceil(t / 2), s = new Uint16Array(a), r = t & 1;
    r && (s[0] = e[0]);
    for (let b = r, p = r; b < t; b += 2, p++)
      s[p] = e[b] << 8 | e[b + 1];
    const i = [];
    let c = 0;
    for (; c < a; ) {
      let b = 0;
      for (let p = c; p < a; p++) {
        const m = b * 65536 + s[p], h = Math.floor(m / hr);
        b = m - h * hr, s[p] = h, h === 0 && p === c && c++;
      }
      i.push(b);
    }
    const o = i.length - 1;
    let d = o * 5;
    for (let b = i[o]; d++, !(b < 58); b = Math.floor(b / 58))
      ;
    const u = new Uint8Array(n + d);
    let l = u.length - 1;
    for (let b = 0; b < o; b++) {
      let p = i[b];
      for (let m = 0; m < 5; m++)
        u[l--] = p % 58, p = Math.floor(p / 58);
    }
    for (let b = i[o]; l >= n; b = Math.floor(b / 58))
      u[l--] = b % 58;
    return u;
  },
  decode: (e) => {
    mr(e);
    const t = e.length;
    if (t === 0)
      return new Uint8Array(0);
    if (t >= 65536)
      throw new Error("invalid length");
    let n = 0;
    for (; n < t - 1 && e[n] === 0; )
      n++;
    const a = new Uint16Array(Math.ceil(t * 6 / 16) + 1);
    let s = 0, r = 0, i = t % 5 || 5;
    for (; r < t; ) {
      let u = 0, l = 1;
      for (const p = r + i; r < p; r++) {
        const m = e[r];
        if (m >= 58)
          throw new Error(`invalid integer: ${m}`);
        u = u * 58 + m, l *= 58;
      }
      i = 5;
      let b = u;
      for (let p = 0; p < s; p++) {
        const m = a[p] * l + b;
        b = Math.floor(m / 65536), a[p] = m - b * 65536;
      }
      for (; b > 0; b = Math.floor(b / 65536))
        a[s++] = b % 65536;
    }
    const c = s === 0 ? 1 : s * 2 - (a[s - 1] < 256 ? 1 : 0), o = new Uint8Array(n + c);
    let d = o.length - 1;
    for (let u = 0; u < s; u++) {
      const l = a[u];
      o[d--] = l & 255, d >= n && (o[d--] = l >> 8);
    }
    return o;
  }
}, Xf = (e) => Yf(qf, Hf(e)), fc = /* @__PURE__ */ Wf(() => Xf("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")), Tn = (e) => fc.encode(e), rn = (e) => fc.decode(e);
function ae(e) {
  return Uint8Array.from(atob(e), (t) => t.charCodeAt(0));
}
const Sa = 8192;
function Q0(e) {
  if (e.length < Sa) return btoa(String.fromCharCode(...e));
  let t = "";
  for (var n = 0; n < e.length; n += Sa) {
    const a = e.slice(n, n + Sa);
    t += String.fromCharCode(...a);
  }
  return btoa(t);
}
function Ns(e) {
  var s;
  const t = e.startsWith("0x") ? e.slice(2) : e, n = t.length % 2 === 0 ? t : `0${t}`, a = ((s = n.match(/[0-9a-fA-F]{2}/g)) == null ? void 0 : s.map((r) => parseInt(r, 16))) ?? [];
  if (a.length !== n.length / 2) throw new Error(`Invalid hex string ${e}`);
  return Uint8Array.from(a);
}
function Qe(e) {
  return e.reduce((t, n) => t + n.toString(16).padStart(2, "0"), "");
}
function Kf(e, t) {
  switch (t) {
    case "base58":
      return Tn(e);
    case "base64":
      return Q0(e);
    case "hex":
      return Qe(e);
    default:
      throw new Error("Unsupported encoding, supported values are: base64, hex");
  }
}
function uc(e, t = ["<", ">"]) {
  const [n, a] = t, s = [];
  let r = "", i = 0;
  for (let c = 0; c < e.length; c++) {
    const o = e[c];
    if (o === n && i++, o === a && i--, i === 0 && o === ",") {
      s.push(r.trim()), r = "";
      continue;
    }
    r += o;
  }
  return s.push(r.trim()), s;
}
var e6 = class {
  constructor({ initialSize: e = 1024, maxSize: t = 1 / 0, allocateSize: n = 1024 } = {}) {
    this.bytePosition = 0, this.size = e, this.maxSize = t, this.allocateSize = n, this.dataView = new DataView(new ArrayBuffer(e));
  }
  ensureSizeOrGrow(e) {
    const t = this.bytePosition + e;
    if (t > this.size) {
      const n = Math.min(this.maxSize, Math.max(this.size + t, this.size + this.allocateSize));
      if (t > n) throw new Error(`Attempting to serialize to BCS, but buffer does not have enough size. Allocated size: ${this.size}, Max size: ${this.maxSize}, Required size: ${t}`);
      this.size = n;
      const a = new ArrayBuffer(this.size);
      new Uint8Array(a).set(new Uint8Array(this.dataView.buffer)), this.dataView = new DataView(a);
    }
  }
  /**
  * Shift current cursor position by `bytes`.
  *
  * @param {Number} bytes Number of bytes to
  * @returns {this} Self for possible chaining.
  */
  shift(e) {
    return this.bytePosition += e, this;
  }
  /**
  * Write a U8 value into a buffer and shift cursor position by 1.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  write8(e) {
    return this.ensureSizeOrGrow(1), this.dataView.setUint8(this.bytePosition, Number(e)), this.shift(1);
  }
  /**
  * Write a U8 value into a buffer and shift cursor position by 1.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  writeBytes(e) {
    this.ensureSizeOrGrow(e.length);
    for (let t = 0; t < e.length; t++) this.dataView.setUint8(this.bytePosition + t, e[t]);
    return this.shift(e.length);
  }
  /**
  * Write a U16 value into a buffer and shift cursor position by 2.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  write16(e) {
    return this.ensureSizeOrGrow(2), this.dataView.setUint16(this.bytePosition, Number(e), !0), this.shift(2);
  }
  /**
  * Write a U32 value into a buffer and shift cursor position by 4.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  write32(e) {
    return this.ensureSizeOrGrow(4), this.dataView.setUint32(this.bytePosition, Number(e), !0), this.shift(4);
  }
  /**
  * Write a U64 value into a buffer and shift cursor position by 8.
  * @param {bigint} value Value to write.
  * @returns {this}
  */
  write64(e) {
    return ka(BigInt(e), 8).forEach((t) => this.write8(t)), this;
  }
  /**
  * Write a U128 value into a buffer and shift cursor position by 16.
  *
  * @param {bigint} value Value to write.
  * @returns {this}
  */
  write128(e) {
    return ka(BigInt(e), 16).forEach((t) => this.write8(t)), this;
  }
  /**
  * Write a U256 value into a buffer and shift cursor position by 16.
  *
  * @param {bigint} value Value to write.
  * @returns {this}
  */
  write256(e) {
    return ka(BigInt(e), 32).forEach((t) => this.write8(t)), this;
  }
  /**
  * Write a ULEB value into a buffer and shift cursor position by number of bytes
  * written.
  * @param {Number} value Value to write.
  * @returns {this}
  */
  writeULEB(e) {
    return Qn(e).forEach((t) => this.write8(t)), this;
  }
  /**
  * Write a vector into a buffer by first writing the vector length and then calling
  * a callback on each passed value.
  *
  * @param {Array<Any>} vector Array of elements to write.
  * @param {WriteVecCb} cb Callback to call on each element of the vector.
  * @returns {this}
  */
  writeVec(e, t) {
    return this.writeULEB(e.length), Array.from(e).forEach((n, a) => t(this, n, a, e.length)), this;
  }
  /**
  * Adds support for iterations over the object.
  * @returns {Uint8Array}
  */
  *[Symbol.iterator]() {
    for (let e = 0; e < this.bytePosition; e++) yield this.dataView.getUint8(e);
    return this.toBytes();
  }
  /**
  * Get underlying buffer taking only value bytes (in case initial buffer size was bigger).
  * @returns {Uint8Array} Resulting bcs.
  */
  toBytes() {
    return new Uint8Array(this.dataView.buffer.slice(0, this.bytePosition));
  }
  /**
  * Represent data as 'hex' or 'base64'
  * @param encoding Encoding to use: 'base64' or 'hex'
  */
  toString(e) {
    return Kf(this.toBytes(), e);
  }
};
function ka(e, t) {
  const n = new Uint8Array(t);
  let a = 0;
  for (; e > 0; )
    n[a] = Number(e % BigInt(256)), e = e / BigInt(256), a += 1;
  return n;
}
var wt, Mt, Rt, we = (Rt = class {
  constructor(t) {
    o0(this, wt);
    o0(this, Mt);
    this.name = t.name, this.read = t.read, this.serializedSize = t.serializedSize ?? (() => null), W(this, wt, t.write), W(this, Mt, t.serialize ?? ((n, a) => {
      const s = new e6({
        initialSize: this.serializedSize(n) ?? void 0,
        ...a
      });
      return g(this, wt).call(this, n, s), s.toBytes();
    })), this.validate = t.validate ?? (() => {
    });
  }
  write(t, n) {
    this.validate(t), g(this, wt).call(this, t, n);
  }
  serialize(t, n) {
    return this.validate(t), new t6(this, g(this, Mt).call(this, t, n));
  }
  parse(t) {
    const n = new Gf(t);
    return this.read(n);
  }
  fromHex(t) {
    return this.parse(Ns(t));
  }
  fromBase58(t) {
    return this.parse(rn(t));
  }
  fromBase64(t) {
    return this.parse(ae(t));
  }
  transform({ name: t, input: n, output: a, validate: s }) {
    return new Rt({
      name: t ?? this.name,
      read: (r) => a ? a(this.read(r)) : this.read(r),
      write: (r, i) => g(this, wt).call(this, n ? n(r) : r, i),
      serializedSize: (r) => this.serializedSize(n ? n(r) : r),
      serialize: (r, i) => g(this, Mt).call(this, n ? n(r) : r, i),
      validate: (r) => {
        s == null || s(r), this.validate(n ? n(r) : r);
      }
    });
  }
}, wt = new WeakMap(), Mt = new WeakMap(), Rt);
const lc = Symbol.for("@mysten/serialized-bcs");
function Ka(e) {
  return !!e && typeof e == "object" && e[lc] === !0;
}
var un, Ve, gi, t6 = (gi = class {
  constructor(e, t) {
    o0(this, un);
    o0(this, Ve);
    W(this, un, e), W(this, Ve, t);
  }
  get [lc]() {
    return !0;
  }
  toBytes() {
    return g(this, Ve);
  }
  toHex() {
    return Qe(g(this, Ve));
  }
  toBase64() {
    return Q0(g(this, Ve));
  }
  toBase58() {
    return Tn(g(this, Ve));
  }
  parse() {
    return g(this, un).parse(g(this, Ve));
  }
}, un = new WeakMap(), Ve = new WeakMap(), gi);
function Jn({ size: e, ...t }) {
  return new we({
    ...t,
    serializedSize: () => e
  });
}
function Na({ readMethod: e, writeMethod: t, ...n }) {
  return Jn({
    ...n,
    read: (a) => a[e](),
    write: (a, s) => s[t](a),
    validate: (a) => {
      var s;
      if (a < 0 || a > n.maxValue) throw new TypeError(`Invalid ${n.name} value: ${a}. Expected value in range 0-${n.maxValue}`);
      (s = n.validate) == null || s.call(n, a);
    }
  });
}
function Ca({ readMethod: e, writeMethod: t, ...n }) {
  return Jn({
    ...n,
    read: (a) => a[e](),
    write: (a, s) => s[t](BigInt(a)),
    validate: (a) => {
      var r;
      const s = BigInt(a);
      if (s < 0 || s > n.maxValue) throw new TypeError(`Invalid ${n.name} value: ${s}. Expected value in range 0-${n.maxValue}`);
      (r = n.validate) == null || r.call(n, s);
    }
  });
}
function n6({ serialize: e, ...t }) {
  const n = new we({
    ...t,
    serialize: e,
    write: (a, s) => {
      for (const r of n.serialize(a).toBytes()) s.write8(r);
    }
  });
  return n;
}
function a6({ toBytes: e, fromBytes: t, ...n }) {
  return new we({
    ...n,
    read: (a) => {
      const s = a.readULEB();
      return t(a.readBytes(s));
    },
    write: (a, s) => {
      const r = e(a);
      s.writeULEB(r.length);
      for (let i = 0; i < r.length; i++) s.write8(r[i]);
    },
    serialize: (a) => {
      const s = e(a), r = Qn(s.length), i = new Uint8Array(r.length + s.length);
      return i.set(r, 0), i.set(s, r.length), i;
    },
    validate: (a) => {
      var s;
      if (typeof a != "string") throw new TypeError(`Invalid ${n.name} value: ${a}. Expected string`);
      (s = n.validate) == null || s.call(n, a);
    }
  });
}
function s6(e) {
  let t = null;
  function n() {
    return t || (t = e()), t;
  }
  return new we({
    name: "lazy",
    read: (a) => n().read(a),
    serializedSize: (a) => n().serializedSize(a),
    write: (a, s) => n().write(a, s),
    serialize: (a, s) => n().serialize(a, s).toBytes()
  });
}
var r6 = class extends we {
  constructor({ name: e, fields: t, ...n }) {
    const a = Object.entries(t);
    super({
      name: e,
      serializedSize: (s) => {
        let r = 0;
        for (const [i, c] of a) {
          const o = c.serializedSize(s[i]);
          if (o == null) return null;
          r += o;
        }
        return r;
      },
      read: (s) => {
        const r = {};
        for (const [i, c] of a) r[i] = c.read(s);
        return r;
      },
      write: (s, r) => {
        for (const [i, c] of a) c.write(s[i], r);
      },
      ...n,
      validate: (s) => {
        var r;
        if ((r = n == null ? void 0 : n.validate) == null || r.call(n, s), typeof s != "object" || s == null) throw new TypeError(`Expected object, found ${typeof s}`);
      }
    });
  }
}, i6 = class extends we {
  constructor({ fields: e, ...t }) {
    const n = Object.entries(e);
    super({
      read: (a) => {
        const s = a.readULEB(), r = n[s];
        if (!r) throw new TypeError(`Unknown value ${s} for enum ${t.name}`);
        const [i, c] = r;
        return {
          [i]: (c == null ? void 0 : c.read(a)) ?? !0,
          $kind: i
        };
      },
      write: (a, s) => {
        const [r, i] = Object.entries(a).filter(([c]) => Object.hasOwn(e, c))[0];
        for (let c = 0; c < n.length; c++) {
          const [o, d] = n[c];
          if (o === r) {
            s.writeULEB(c), d == null || d.write(i, s);
            return;
          }
        }
      },
      ...t,
      validate: (a) => {
        var i;
        if ((i = t == null ? void 0 : t.validate) == null || i.call(t, a), typeof a != "object" || a == null) throw new TypeError(`Expected object, found ${typeof a}`);
        const s = Object.keys(a).filter((c) => a[c] !== void 0 && Object.hasOwn(e, c));
        if (s.length !== 1) throw new TypeError(`Expected object with one key, but found ${s.length} for type ${t.name}}`);
        const [r] = s;
        if (!Object.hasOwn(e, r)) throw new TypeError(`Invalid enum variant ${r}`);
      }
    });
  }
}, c6 = class extends we {
  constructor({ fields: e, name: t, ...n }) {
    super({
      name: t ?? `(${e.map((a) => a.name).join(", ")})`,
      serializedSize: (a) => {
        let s = 0;
        for (let r = 0; r < e.length; r++) {
          const i = e[r].serializedSize(a[r]);
          if (i == null) return null;
          s += i;
        }
        return s;
      },
      read: (a) => {
        const s = [];
        for (const r of e) s.push(r.read(a));
        return s;
      },
      write: (a, s) => {
        for (let r = 0; r < e.length; r++) e[r].write(a[r], s);
      },
      ...n,
      validate: (a) => {
        var s;
        if ((s = n == null ? void 0 : n.validate) == null || s.call(n, a), !Array.isArray(a)) throw new TypeError(`Expected array, found ${typeof a}`);
        if (a.length !== e.length) throw new TypeError(`Expected array of length ${e.length}, found ${a.length}`);
      }
    });
  }
};
function o6(e, t, n) {
  return new we({
    read: (a) => {
      const s = new Array(e);
      for (let r = 0; r < e; r++) s[r] = t.read(a);
      return s;
    },
    write: (a, s) => {
      for (const r of a) t.write(r, s);
    },
    ...n,
    name: (n == null ? void 0 : n.name) ?? `${t.name}[${e}]`,
    validate: (a) => {
      var s;
      if ((s = n == null ? void 0 : n.validate) == null || s.call(n, a), !a || typeof a != "object" || !("length" in a)) throw new TypeError(`Expected array, found ${typeof a}`);
      if (a.length !== e) throw new TypeError(`Expected array of length ${e}, found ${a.length}`);
    }
  });
}
function d6(e) {
  return f.enum(`Option<${e.name}>`, {
    None: null,
    Some: e
  }).transform({
    input: (t) => t == null ? { None: !0 } : { Some: t },
    output: (t) => t.$kind === "Some" ? t.Some : null
  });
}
function f6(e, t) {
  return new we({
    read: (n) => {
      const a = n.readULEB(), s = new Array(a);
      for (let r = 0; r < a; r++) s[r] = e.read(n);
      return s;
    },
    write: (n, a) => {
      a.writeULEB(n.length);
      for (const s of n) e.write(s, a);
    },
    ...t,
    name: (t == null ? void 0 : t.name) ?? `vector<${e.name}>`,
    validate: (n) => {
      var a;
      if ((a = t == null ? void 0 : t.validate) == null || a.call(t, n), !n || typeof n != "object" || !("length" in n)) throw new TypeError(`Expected array, found ${typeof n}`);
    }
  });
}
function u6(e, t) {
  for (let n = 0; n < Math.min(e.length, t.length); n++) if (e[n] !== t[n]) return e[n] - t[n];
  return e.length - t.length;
}
function l6(e, t) {
  return new we({
    name: `Map<${e.name}, ${t.name}>`,
    read: (n) => {
      const a = n.readULEB(), s = /* @__PURE__ */ new Map();
      for (let r = 0; r < a; r++) s.set(e.read(n), t.read(n));
      return s;
    },
    write: (n, a) => {
      const s = [...n.entries()].map(([r, i]) => [e.serialize(r).toBytes(), i]);
      s.sort(([r], [i]) => u6(r, i)), a.writeULEB(s.length);
      for (const [r, i] of s)
        a.writeBytes(r), t.write(i, a);
    }
  });
}
const f = {
  u8(e) {
    return Na({
      readMethod: "read8",
      writeMethod: "write8",
      size: 1,
      maxValue: 2 ** 8 - 1,
      ...e,
      name: (e == null ? void 0 : e.name) ?? "u8"
    });
  },
  u16(e) {
    return Na({
      readMethod: "read16",
      writeMethod: "write16",
      size: 2,
      maxValue: 2 ** 16 - 1,
      ...e,
      name: (e == null ? void 0 : e.name) ?? "u16"
    });
  },
  u32(e) {
    return Na({
      readMethod: "read32",
      writeMethod: "write32",
      size: 4,
      maxValue: 2 ** 32 - 1,
      ...e,
      name: (e == null ? void 0 : e.name) ?? "u32"
    });
  },
  u64(e) {
    return Ca({
      readMethod: "read64",
      writeMethod: "write64",
      size: 8,
      maxValue: 2n ** 64n - 1n,
      ...e,
      name: (e == null ? void 0 : e.name) ?? "u64"
    });
  },
  u128(e) {
    return Ca({
      readMethod: "read128",
      writeMethod: "write128",
      size: 16,
      maxValue: 2n ** 128n - 1n,
      ...e,
      name: (e == null ? void 0 : e.name) ?? "u128"
    });
  },
  u256(e) {
    return Ca({
      readMethod: "read256",
      writeMethod: "write256",
      size: 32,
      maxValue: 2n ** 256n - 1n,
      ...e,
      name: (e == null ? void 0 : e.name) ?? "u256"
    });
  },
  bool(e) {
    return Jn({
      size: 1,
      read: (t) => t.read8() === 1,
      write: (t, n) => n.write8(t ? 1 : 0),
      ...e,
      name: (e == null ? void 0 : e.name) ?? "bool",
      validate: (t) => {
        var n;
        if ((n = e == null ? void 0 : e.validate) == null || n.call(e, t), typeof t != "boolean") throw new TypeError(`Expected boolean, found ${typeof t}`);
      }
    });
  },
  uleb128(e) {
    return n6({
      read: (t) => t.readULEB(),
      serialize: (t) => Uint8Array.from(Qn(t)),
      ...e,
      name: (e == null ? void 0 : e.name) ?? "uleb128"
    });
  },
  bytes(e, t) {
    return Jn({
      size: e,
      read: (n) => n.readBytes(e),
      write: (n, a) => {
        a.writeBytes(new Uint8Array(n));
      },
      ...t,
      name: (t == null ? void 0 : t.name) ?? `bytes[${e}]`,
      validate: (n) => {
        var a;
        if ((a = t == null ? void 0 : t.validate) == null || a.call(t, n), !n || typeof n != "object" || !("length" in n)) throw new TypeError(`Expected array, found ${typeof n}`);
        if (n.length !== e) throw new TypeError(`Expected array of length ${e}, found ${n.length}`);
      }
    });
  },
  byteVector(e) {
    return new we({
      read: (t) => {
        const n = t.readULEB();
        return t.readBytes(n);
      },
      write: (t, n) => {
        const a = new Uint8Array(t);
        n.writeULEB(a.length), n.writeBytes(a);
      },
      ...e,
      name: (e == null ? void 0 : e.name) ?? "vector<u8>",
      serializedSize: (t) => {
        const n = "length" in t ? t.length : null;
        return n == null ? null : Qn(n).length + n;
      },
      validate: (t) => {
        var n;
        if ((n = e == null ? void 0 : e.validate) == null || n.call(e, t), !t || typeof t != "object" || !("length" in t)) throw new TypeError(`Expected array, found ${typeof t}`);
      }
    });
  },
  string(e) {
    return a6({
      toBytes: (t) => new TextEncoder().encode(t),
      fromBytes: (t) => new TextDecoder().decode(t),
      ...e,
      name: (e == null ? void 0 : e.name) ?? "string"
    });
  },
  fixedArray: o6,
  option: d6,
  vector: f6,
  tuple(e, t) {
    return new c6({
      fields: e,
      ...t
    });
  },
  struct(e, t, n) {
    return new r6({
      name: e,
      fields: t,
      ...n
    });
  },
  enum(e, t, n) {
    return new i6({
      name: e,
      fields: t,
      ...n
    });
  },
  map: l6,
  lazy(e) {
    return s6(e);
  }
}, la = 32;
function cn(e) {
  return g6(e) && h6(e) === la;
}
const b6 = /^[a-zA-Z][a-zA-Z0-9_]*$/;
function Ar(e) {
  return b6.test(e);
}
const p6 = [
  "bool",
  "u8",
  "u16",
  "u32",
  "u64",
  "u128",
  "u256",
  "address",
  "signer"
], m6 = /^vector<(.+)>$/;
function bc(e) {
  if (p6.includes(e)) return !0;
  const t = e.match(m6);
  return t ? bc(t[1]) : e.includes("::") ? mc(e) : !1;
}
function pc(e) {
  return !cn(e.address) && !wn(e.address) || !Ar(e.module) || !Ar(e.name) ? !1 : e.typeParams.every((t) => typeof t == "string" ? bc(t) : pc(t));
}
function mc(e) {
  try {
    return pc(ot(e));
  } catch {
    return !1;
  }
}
function gc(e) {
  if (e.startsWith("vector<")) {
    if (!e.endsWith(">")) throw new Error(`Invalid type tag: ${e}`);
    const t = e.slice(7, -1);
    if (!t) throw new Error(`Invalid type tag: ${e}`);
    const n = gc(t);
    return typeof n == "string" ? `vector<${n}>` : `vector<${ye(n)}>`;
  }
  return e.includes("::") ? ot(e) : e;
}
function ot(e) {
  const t = e.split("::");
  if (t.length < 3) throw new Error(`Invalid struct tag: ${e}`);
  const [n, a] = t;
  if (!n || !a) throw new Error(`Invalid struct tag: ${e}`);
  const s = wn(n), r = e.slice(n.length + a.length + 4), i = r.includes("<") ? r.slice(0, r.indexOf("<")) : r;
  if (!i || r.includes("<") && !r.endsWith(">")) throw new Error(`Invalid struct tag: ${e}`);
  const c = r.includes("<") ? uc(r.slice(r.indexOf("<") + 1, r.lastIndexOf(">"))).map((o) => gc(o.trim())) : [];
  return {
    address: s ? n : H(n),
    module: a,
    name: i,
    typeParams: c
  };
}
function ye(e) {
  if (typeof e == "string" && e.startsWith("vector<")) throw new Error("normalizeStructTag does not support vector types. Use normalizeTypeTag instead.");
  const { address: t, module: n, name: a, typeParams: s } = typeof e == "string" ? ot(e) : e;
  return `${t}::${n}::${a}${(s == null ? void 0 : s.length) > 0 ? `<${s.map((r) => typeof r == "string" ? r : ye(r)).join(",")}>` : ""}`;
}
function H(e, t = !1) {
  let n = e.toLowerCase();
  return !t && n.startsWith("0x") && (n = n.slice(2)), `0x${n.padStart(la * 2, "0")}`;
}
function es(e, t = !1) {
  return H(e, t);
}
function g6(e) {
  return /^(0x|0X)?[a-fA-F0-9]+$/.test(e) && e.length % 2 === 0;
}
function h6(e) {
  return /^(0x|0X)/.test(e) ? (e.length - 2) / 2 : e.length / 2;
}
const A6 = {
  lang: void 0,
  message: void 0,
  abortEarly: void 0,
  abortPipeEarly: void 0
};
// @__NO_SIDE_EFFECTS__
function hc(e) {
  return A6;
}
let xa;
// @__NO_SIDE_EFFECTS__
function y6(e) {
  return xa == null ? void 0 : xa.get(e);
}
let _a;
// @__NO_SIDE_EFFECTS__
function w6(e) {
  return _a == null ? void 0 : _a.get(e);
}
let Ba;
// @__NO_SIDE_EFFECTS__
function T6(e, t) {
  var n;
  return (n = Ba == null ? void 0 : Ba.get(e)) == null ? void 0 : n.get(t);
}
// @__NO_SIDE_EFFECTS__
function Cs(e) {
  var n, a;
  const t = typeof e;
  return t === "string" ? `"${e}"` : t === "number" || t === "bigint" || t === "boolean" ? `${e}` : t === "object" || t === "function" ? (e && ((a = (n = Object.getPrototypeOf(e)) == null ? void 0 : n.constructor) == null ? void 0 : a.name)) ?? "null" : t;
}
function J0(e, t, n, a, s) {
  const r = s && "input" in s ? s.input : n.value, i = (s == null ? void 0 : s.expected) ?? e.expects ?? null, c = (s == null ? void 0 : s.received) ?? /* @__PURE__ */ Cs(r), o = {
    kind: e.kind,
    type: e.type,
    input: r,
    expected: i,
    received: c,
    message: `Invalid ${t}: ${i ? `Expected ${i} but r` : "R"}eceived ${c}`,
    requirement: e.requirement,
    path: s == null ? void 0 : s.path,
    issues: s == null ? void 0 : s.issues,
    lang: a.lang,
    abortEarly: a.abortEarly,
    abortPipeEarly: a.abortPipeEarly
  }, d = e.kind === "schema", u = (s == null ? void 0 : s.message) ?? e.message ?? /* @__PURE__ */ T6(e.reference, o.lang) ?? (d ? /* @__PURE__ */ w6(o.lang) : null) ?? a.message ?? /* @__PURE__ */ y6(o.lang);
  u !== void 0 && (o.message = typeof u == "function" ? u(o) : u), d && (n.typed = !1), n.issues ? n.issues.push(o) : n.issues = [o];
}
const yr = /* @__PURE__ */ new WeakMap();
// @__NO_SIDE_EFFECTS__
function V0(e) {
  let t = yr.get(e);
  return t || (t = {
    version: 1,
    vendor: "valibot",
    validate(n) {
      return e["~run"]({ value: n }, /* @__PURE__ */ hc());
    }
  }, yr.set(e, t)), t;
}
// @__NO_SIDE_EFFECTS__
function v6(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t) && t !== "__proto__" && t !== "prototype" && t !== "constructor";
}
// @__NO_SIDE_EFFECTS__
function Ac(e, t) {
  const n = [...new Set(e)];
  return n.length > 1 ? `(${n.join(` ${t} `)})` : n[0] ?? "never";
}
var I6 = class extends Error {
  /**
  * Creates a Valibot error with useful information.
  *
  * @param issues The error issues.
  */
  constructor(e) {
    super(e[0].message), this.name = "ValiError", this.issues = e;
  }
};
// @__NO_SIDE_EFFECTS__
function ba(e, t) {
  return {
    kind: "validation",
    type: "check",
    reference: ba,
    async: !1,
    expects: null,
    requirement: e,
    message: t,
    "~run"(n, a) {
      return n.typed && !this.requirement(n.value) && J0(this, "input", n, a), n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function G0(e) {
  return {
    kind: "validation",
    type: "integer",
    reference: G0,
    async: !1,
    expects: null,
    requirement: Number.isInteger,
    message: e,
    "~run"(t, n) {
      return t.typed && !this.requirement(t.value) && J0(this, "integer", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function pa(e) {
  return {
    kind: "transformation",
    type: "transform",
    reference: pa,
    async: !1,
    operation: e,
    "~run"(t) {
      return t.value = this.operation(t.value), t;
    }
  };
}
const O6 = { abortEarly: !0 };
// @__NO_SIDE_EFFECTS__
function E6(e, t, n) {
  return typeof e.fallback == "function" ? e.fallback(t, n) : e.fallback;
}
// @__NO_SIDE_EFFECTS__
function ma(e, t, n) {
  return typeof e.default == "function" ? e.default(t, n) : e.default;
}
// @__NO_SIDE_EFFECTS__
function ts(e, t) {
  return !e["~run"]({ value: t }, O6).issues;
}
// @__NO_SIDE_EFFECTS__
function n0(e, t) {
  return {
    kind: "schema",
    type: "array",
    reference: n0,
    expects: "Array",
    async: !1,
    item: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(n, a) {
      var r;
      const s = n.value;
      if (Array.isArray(s)) {
        n.typed = !0, n.value = [];
        for (let i = 0; i < s.length; i++) {
          const c = s[i], o = this.item["~run"]({ value: c }, a);
          if (o.issues) {
            const d = {
              type: "array",
              origin: "value",
              input: s,
              key: i,
              value: c
            };
            for (const u of o.issues)
              u.path ? u.path.unshift(d) : u.path = [d], (r = n.issues) == null || r.push(u);
            if (n.issues || (n.issues = o.issues), a.abortEarly) {
              n.typed = !1;
              break;
            }
          }
          o.typed || (n.typed = !1), n.value.push(o.value);
        }
      } else J0(this, "type", n, a);
      return n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function xs(e) {
  return {
    kind: "schema",
    type: "bigint",
    reference: xs,
    expects: "bigint",
    async: !1,
    message: e,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(t, n) {
      return typeof t.value == "bigint" ? t.typed = !0 : J0(this, "type", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function Vt(e) {
  return {
    kind: "schema",
    type: "boolean",
    reference: Vt,
    expects: "boolean",
    async: !1,
    message: e,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(t, n) {
      return typeof t.value == "boolean" ? t.typed = !0 : J0(this, "type", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function ns(e) {
  return {
    kind: "schema",
    type: "lazy",
    reference: ns,
    expects: "unknown",
    async: !1,
    getter: e,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(t, n) {
      return this.getter(t.value)["~run"](t, n);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function d0(e, t) {
  return {
    kind: "schema",
    type: "literal",
    reference: d0,
    expects: /* @__PURE__ */ Cs(e),
    async: !1,
    literal: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(n, a) {
      return n.value === this.literal ? n.typed = !0 : J0(this, "type", n, a), n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function h0(e, t) {
  return {
    kind: "schema",
    type: "nullable",
    reference: h0,
    expects: `(${e.expects} | null)`,
    async: !1,
    wrapped: e,
    default: t,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(n, a) {
      return n.value === null && (this.default !== void 0 && (n.value = /* @__PURE__ */ ma(this, n, a)), n.value === null) ? (n.typed = !0, n) : this.wrapped["~run"](n, a);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function on(e, t) {
  return {
    kind: "schema",
    type: "nullish",
    reference: on,
    expects: `(${e.expects} | null | undefined)`,
    async: !1,
    wrapped: e,
    default: t,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(n, a) {
      return (n.value === null || n.value === void 0) && (this.default !== void 0 && (n.value = /* @__PURE__ */ ma(this, n, a)), n.value === null || n.value === void 0) ? (n.typed = !0, n) : this.wrapped["~run"](n, a);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function W0(e) {
  return {
    kind: "schema",
    type: "number",
    reference: W0,
    expects: "number",
    async: !1,
    message: e,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(t, n) {
      return typeof t.value == "number" && !isNaN(t.value) ? t.typed = !0 : J0(this, "type", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function U(e, t) {
  return {
    kind: "schema",
    type: "object",
    reference: U,
    expects: "Object",
    async: !1,
    entries: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(n, a) {
      var r;
      const s = n.value;
      if (s && typeof s == "object") {
        n.typed = !0, n.value = {};
        for (const i in this.entries) {
          const c = this.entries[i];
          if (i in s || (c.type === "exact_optional" || c.type === "optional" || c.type === "nullish") && c.default !== void 0) {
            const o = i in s ? s[i] : /* @__PURE__ */ ma(c), d = c["~run"]({ value: o }, a);
            if (d.issues) {
              const u = {
                type: "object",
                origin: "value",
                input: s,
                key: i,
                value: o
              };
              for (const l of d.issues)
                l.path ? l.path.unshift(u) : l.path = [u], (r = n.issues) == null || r.push(l);
              if (n.issues || (n.issues = d.issues), a.abortEarly) {
                n.typed = !1;
                break;
              }
            }
            d.typed || (n.typed = !1), n.value[i] = d.value;
          } else if (c.fallback !== void 0) n.value[i] = /* @__PURE__ */ E6(c);
          else if (c.type !== "exact_optional" && c.type !== "optional" && c.type !== "nullish" && (J0(this, "key", n, a, {
            input: void 0,
            expected: `"${i}"`,
            path: [{
              type: "object",
              origin: "key",
              input: s,
              key: i,
              value: s[i]
            }]
          }), a.abortEarly))
            break;
        }
      } else J0(this, "type", n, a);
      return n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function K0(e, t) {
  return {
    kind: "schema",
    type: "optional",
    reference: K0,
    expects: `(${e.expects} | undefined)`,
    async: !1,
    wrapped: e,
    default: t,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(n, a) {
      return n.value === void 0 && (this.default !== void 0 && (n.value = /* @__PURE__ */ ma(this, n, a)), n.value === void 0) ? (n.typed = !0, n) : this.wrapped["~run"](n, a);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function yc(e, t) {
  return {
    kind: "schema",
    type: "picklist",
    reference: yc,
    expects: /* @__PURE__ */ Ac(e.map(Cs), "|"),
    async: !1,
    options: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(n, a) {
      return this.options.includes(n.value) ? n.typed = !0 : J0(this, "type", n, a), n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function dn(e, t, n) {
  return {
    kind: "schema",
    type: "record",
    reference: dn,
    expects: "Object",
    async: !1,
    key: e,
    value: t,
    message: n,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(a, s) {
      var i, c;
      const r = a.value;
      if (r && typeof r == "object") {
        a.typed = !0, a.value = {};
        for (const o in r) if (/* @__PURE__ */ v6(r, o)) {
          const d = r[o], u = this.key["~run"]({ value: o }, s);
          if (u.issues) {
            const b = {
              type: "object",
              origin: "key",
              input: r,
              key: o,
              value: d
            };
            for (const p of u.issues)
              p.path = [b], (i = a.issues) == null || i.push(p);
            if (a.issues || (a.issues = u.issues), s.abortEarly) {
              a.typed = !1;
              break;
            }
          }
          const l = this.value["~run"]({ value: d }, s);
          if (l.issues) {
            const b = {
              type: "object",
              origin: "value",
              input: r,
              key: o,
              value: d
            };
            for (const p of l.issues)
              p.path ? p.path.unshift(b) : p.path = [b], (c = a.issues) == null || c.push(p);
            if (a.issues || (a.issues = l.issues), s.abortEarly) {
              a.typed = !1;
              break;
            }
          }
          (!u.typed || !l.typed) && (a.typed = !1), u.typed && (a.value[u.value] = l.value);
        }
      } else J0(this, "type", a, s);
      return a;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function i0(e) {
  return {
    kind: "schema",
    type: "string",
    reference: i0,
    expects: "string",
    async: !1,
    message: e,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(t, n) {
      return typeof t.value == "string" ? t.typed = !0 : J0(this, "type", t, n), t;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function _s(e, t) {
  return {
    kind: "schema",
    type: "tuple",
    reference: _s,
    expects: "Array",
    async: !1,
    items: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(n, a) {
      var r;
      const s = n.value;
      if (Array.isArray(s)) {
        n.typed = !0, n.value = [];
        for (let i = 0; i < this.items.length; i++) {
          const c = s[i], o = this.items[i]["~run"]({ value: c }, a);
          if (o.issues) {
            const d = {
              type: "array",
              origin: "value",
              input: s,
              key: i,
              value: c
            };
            for (const u of o.issues)
              u.path ? u.path.unshift(d) : u.path = [d], (r = n.issues) == null || r.push(u);
            if (n.issues || (n.issues = o.issues), a.abortEarly) {
              n.typed = !1;
              break;
            }
          }
          o.typed || (n.typed = !1), n.value.push(o.value);
        }
      } else J0(this, "type", n, a);
      return n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function wr(e) {
  let t;
  if (e) for (const n of e) if (t) for (const a of n.issues) t.push(a);
  else t = n.issues;
  return t;
}
// @__NO_SIDE_EFFECTS__
function fe(e, t) {
  return {
    kind: "schema",
    type: "union",
    reference: fe,
    expects: /* @__PURE__ */ Ac(e.map((n) => n.expects), "|"),
    async: !1,
    options: e,
    message: t,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(n, a) {
      let s, r, i;
      for (const c of this.options) {
        const o = c["~run"]({ value: n.value }, a);
        if (o.typed) if (o.issues) r ? r.push(o) : r = [o];
        else {
          s = o;
          break;
        }
        else i ? i.push(o) : i = [o];
      }
      if (s) return s;
      if (r) {
        if (r.length === 1) return r[0];
        J0(this, "type", n, a, { issues: /* @__PURE__ */ wr(r) }), n.typed = !0;
      } else {
        if ((i == null ? void 0 : i.length) === 1) return i[0];
        J0(this, "type", n, a, { issues: /* @__PURE__ */ wr(i) });
      }
      return n;
    }
  };
}
// @__NO_SIDE_EFFECTS__
function vn() {
  return {
    kind: "schema",
    type: "unknown",
    reference: vn,
    expects: "unknown",
    async: !1,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(e) {
      return e.typed = !0, e;
    }
  };
}
function y0(e, t, n) {
  const a = e["~run"]({ value: t }, /* @__PURE__ */ hc());
  if (a.issues) throw new I6(a.issues);
  return a.value;
}
// @__NO_SIDE_EFFECTS__
function D0(...e) {
  return {
    ...e[0],
    pipe: e,
    get "~standard"() {
      return /* @__PURE__ */ V0(this);
    },
    "~run"(t, n) {
      for (const a of e) if (a.kind !== "metadata") {
        if (t.issues && (a.kind === "schema" || a.kind === "transformation")) {
          t.typed = !1;
          break;
        }
        (!t.issues || !n.abortEarly && !n.abortPipeEarly) && (t = a["~run"](t, n));
      }
      return t;
    }
  };
}
function xe(e) {
  return /* @__PURE__ */ fe(Object.keys(e).map((t) => Zt(t, /* @__PURE__ */ U({ [t]: e[t] }))));
}
function Zt(e, t) {
  return /* @__PURE__ */ D0(/* @__PURE__ */ U({
    ...t.entries,
    $kind: /* @__PURE__ */ K0(/* @__PURE__ */ d0(e))
  }), /* @__PURE__ */ pa((n) => ({
    ...n,
    $kind: e
  })));
}
const zt = /* @__PURE__ */ D0(/* @__PURE__ */ i0(), /* @__PURE__ */ pa((e) => H(e)), /* @__PURE__ */ ba(cn)), se = zt, It = /* @__PURE__ */ i0(), M0 = /* @__PURE__ */ D0(/* @__PURE__ */ fe([/* @__PURE__ */ i0(), /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0())]), /* @__PURE__ */ ba((e) => {
  try {
    return BigInt(e), BigInt(e) >= 0 && BigInt(e) <= 18446744073709551615n;
  } catch {
    return !1;
  }
}, "Invalid u64")), S6 = /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0(), /* @__PURE__ */ ba((e) => e >= 0 && e < 2 ** 32, "Invalid u32")), dt = /* @__PURE__ */ U({
  objectId: zt,
  version: M0,
  digest: /* @__PURE__ */ i0()
}), w0 = /* @__PURE__ */ fe([
  Zt("GasCoin", /* @__PURE__ */ U({ GasCoin: /* @__PURE__ */ d0(!0) })),
  Zt("Input", /* @__PURE__ */ U({
    Input: /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0()),
    type: /* @__PURE__ */ K0(/* @__PURE__ */ fe([
      /* @__PURE__ */ d0("pure"),
      /* @__PURE__ */ d0("object"),
      /* @__PURE__ */ d0("withdrawal")
    ]))
  })),
  Zt("Result", /* @__PURE__ */ U({ Result: /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0()) })),
  Zt("NestedResult", /* @__PURE__ */ U({ NestedResult: /* @__PURE__ */ _s([/* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0()), /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0())]) }))
]), k6 = /* @__PURE__ */ U({
  budget: /* @__PURE__ */ h0(M0),
  price: /* @__PURE__ */ h0(M0),
  owner: /* @__PURE__ */ h0(zt),
  payment: /* @__PURE__ */ h0(/* @__PURE__ */ n0(dt))
}), as = /* @__PURE__ */ fe([
  /* @__PURE__ */ U({ $kind: /* @__PURE__ */ d0("address") }),
  /* @__PURE__ */ U({ $kind: /* @__PURE__ */ d0("bool") }),
  /* @__PURE__ */ U({ $kind: /* @__PURE__ */ d0("u8") }),
  /* @__PURE__ */ U({ $kind: /* @__PURE__ */ d0("u16") }),
  /* @__PURE__ */ U({ $kind: /* @__PURE__ */ d0("u32") }),
  /* @__PURE__ */ U({ $kind: /* @__PURE__ */ d0("u64") }),
  /* @__PURE__ */ U({ $kind: /* @__PURE__ */ d0("u128") }),
  /* @__PURE__ */ U({ $kind: /* @__PURE__ */ d0("u256") }),
  /* @__PURE__ */ U({ $kind: /* @__PURE__ */ d0("unknown") }),
  /* @__PURE__ */ U({
    $kind: /* @__PURE__ */ d0("vector"),
    vector: /* @__PURE__ */ ns(() => as)
  }),
  /* @__PURE__ */ U({
    $kind: /* @__PURE__ */ d0("datatype"),
    datatype: /* @__PURE__ */ U({
      typeName: /* @__PURE__ */ i0(),
      typeParameters: /* @__PURE__ */ n0(/* @__PURE__ */ ns(() => as))
    })
  }),
  /* @__PURE__ */ U({
    $kind: /* @__PURE__ */ d0("typeParameter"),
    index: /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0())
  })
]), N6 = /* @__PURE__ */ U({
  reference: /* @__PURE__ */ h0(/* @__PURE__ */ fe([
    /* @__PURE__ */ d0("mutable"),
    /* @__PURE__ */ d0("immutable"),
    /* @__PURE__ */ d0("unknown")
  ])),
  body: as
}), C6 = /* @__PURE__ */ U({
  package: se,
  module: /* @__PURE__ */ i0(),
  function: /* @__PURE__ */ i0(),
  typeArguments: /* @__PURE__ */ n0(/* @__PURE__ */ i0()),
  arguments: /* @__PURE__ */ n0(w0),
  _argumentTypes: /* @__PURE__ */ K0(/* @__PURE__ */ h0(/* @__PURE__ */ n0(N6)))
}), x6 = /* @__PURE__ */ U({
  name: /* @__PURE__ */ i0(),
  inputs: /* @__PURE__ */ dn(/* @__PURE__ */ i0(), /* @__PURE__ */ fe([w0, /* @__PURE__ */ n0(w0)])),
  data: /* @__PURE__ */ dn(/* @__PURE__ */ i0(), /* @__PURE__ */ vn())
}), _6 = xe({
  MoveCall: C6,
  TransferObjects: /* @__PURE__ */ U({
    objects: /* @__PURE__ */ n0(w0),
    address: w0
  }),
  SplitCoins: /* @__PURE__ */ U({
    coin: w0,
    amounts: /* @__PURE__ */ n0(w0)
  }),
  MergeCoins: /* @__PURE__ */ U({
    destination: w0,
    sources: /* @__PURE__ */ n0(w0)
  }),
  Publish: /* @__PURE__ */ U({
    modules: /* @__PURE__ */ n0(It),
    dependencies: /* @__PURE__ */ n0(se)
  }),
  MakeMoveVec: /* @__PURE__ */ U({
    type: /* @__PURE__ */ h0(/* @__PURE__ */ i0()),
    elements: /* @__PURE__ */ n0(w0)
  }),
  Upgrade: /* @__PURE__ */ U({
    modules: /* @__PURE__ */ n0(It),
    dependencies: /* @__PURE__ */ n0(se),
    package: se,
    ticket: w0
  }),
  $Intent: x6
}), wc = xe({
  ImmOrOwnedObject: dt,
  SharedObject: /* @__PURE__ */ U({
    objectId: se,
    initialSharedVersion: M0,
    mutable: /* @__PURE__ */ Vt()
  }),
  Receiving: dt
}), B6 = xe({ MaxAmountU64: M0 }), j6 = xe({ Balance: /* @__PURE__ */ i0() }), M6 = xe({
  Sender: /* @__PURE__ */ d0(!0),
  Sponsor: /* @__PURE__ */ d0(!0)
}), Tc = /* @__PURE__ */ U({
  reservation: B6,
  typeArg: j6,
  withdrawFrom: M6
}), R6 = xe({
  Object: wc,
  Pure: /* @__PURE__ */ U({ bytes: It }),
  UnresolvedPure: /* @__PURE__ */ U({ value: /* @__PURE__ */ vn() }),
  UnresolvedObject: /* @__PURE__ */ U({
    objectId: se,
    version: /* @__PURE__ */ K0(/* @__PURE__ */ h0(M0)),
    digest: /* @__PURE__ */ K0(/* @__PURE__ */ h0(/* @__PURE__ */ i0())),
    initialSharedVersion: /* @__PURE__ */ K0(/* @__PURE__ */ h0(M0)),
    mutable: /* @__PURE__ */ K0(/* @__PURE__ */ h0(/* @__PURE__ */ Vt()))
  }),
  FundsWithdrawal: Tc
}), Tr = xe({
  Object: wc,
  Pure: /* @__PURE__ */ U({ bytes: It })
}), vc = /* @__PURE__ */ U({
  minEpoch: /* @__PURE__ */ h0(M0),
  maxEpoch: /* @__PURE__ */ h0(M0),
  minTimestamp: /* @__PURE__ */ h0(M0),
  maxTimestamp: /* @__PURE__ */ h0(M0),
  chain: /* @__PURE__ */ i0(),
  nonce: S6
}), Ic = xe({
  None: /* @__PURE__ */ d0(!0),
  Epoch: M0,
  ValidDuring: vc
}), Dn = /* @__PURE__ */ U({
  version: /* @__PURE__ */ d0(2),
  sender: /* @__PURE__ */ on(zt),
  expiration: /* @__PURE__ */ on(Ic),
  gasData: k6,
  inputs: /* @__PURE__ */ n0(R6),
  commands: /* @__PURE__ */ n0(_6)
});
function Yn(e) {
  if (typeof e == "string") return H(e);
  if (e.Object)
    return e.Object.ImmOrOwnedObject ? H(e.Object.ImmOrOwnedObject.objectId) : e.Object.Receiving ? H(e.Object.Receiving.objectId) : H(e.Object.SharedObject.objectId);
  if (e.UnresolvedObject) return H(e.UnresolvedObject.objectId);
}
function D6(e, t, n) {
  const a = (s) => {
    switch (s.$kind) {
      case "Input": {
        const r = t.get(s.Input);
        if (r === void 0) throw new Error(`Input ${s.Input} not found in input mapping`);
        return {
          ...s,
          Input: r
        };
      }
      case "Result": {
        const r = n.get(s.Result);
        return r !== void 0 ? {
          ...s,
          Result: r
        } : s;
      }
      case "NestedResult": {
        const r = n.get(s.NestedResult[0]);
        return r !== void 0 ? {
          ...s,
          NestedResult: [r, s.NestedResult[1]]
        } : s;
      }
      default:
        return s;
    }
  };
  switch (e.$kind) {
    case "MoveCall":
      e.MoveCall.arguments = e.MoveCall.arguments.map(a);
      break;
    case "TransferObjects":
      e.TransferObjects.objects = e.TransferObjects.objects.map(a), e.TransferObjects.address = a(e.TransferObjects.address);
      break;
    case "SplitCoins":
      e.SplitCoins.coin = a(e.SplitCoins.coin), e.SplitCoins.amounts = e.SplitCoins.amounts.map(a);
      break;
    case "MergeCoins":
      e.MergeCoins.destination = a(e.MergeCoins.destination), e.MergeCoins.sources = e.MergeCoins.sources.map(a);
      break;
    case "MakeMoveVec":
      e.MakeMoveVec.elements = e.MakeMoveVec.elements.map(a);
      break;
    case "Upgrade":
      e.Upgrade.ticket = a(e.Upgrade.ticket);
      break;
    case "$Intent": {
      const s = e.$Intent.inputs;
      e.$Intent.inputs = {};
      for (const [r, i] of Object.entries(s)) e.$Intent.inputs[r] = Array.isArray(i) ? i.map(a) : a(i);
      break;
    }
  }
}
const U6 = /^vector<(.+)>$/, P6 = /^([^:]+)::([^:]+)::([^<]+)(<(.+)>)?/;
var Ft = class xt {
  static parseFromStr(t, n = !1) {
    if (t === "address") return { address: null };
    if (t === "bool") return { bool: null };
    if (t === "u8") return { u8: null };
    if (t === "u16") return { u16: null };
    if (t === "u32") return { u32: null };
    if (t === "u64") return { u64: null };
    if (t === "u128") return { u128: null };
    if (t === "u256") return { u256: null };
    if (t === "signer") return { signer: null };
    const a = t.match(U6);
    if (a) return { vector: xt.parseFromStr(a[1], n) };
    const s = t.match(P6);
    if (s) return { struct: {
      address: n ? H(s[1]) : s[1],
      module: s[2],
      name: s[3],
      typeParams: s[5] === void 0 ? [] : xt.parseStructTypeArgs(s[5], n)
    } };
    throw new Error(`Encountered unexpected token when parsing type args for ${t}`);
  }
  static parseStructTypeArgs(t, n = !1) {
    return uc(t).map((a) => xt.parseFromStr(a, n));
  }
  static tagToString(t) {
    if ("bool" in t) return "bool";
    if ("u8" in t) return "u8";
    if ("u16" in t) return "u16";
    if ("u32" in t) return "u32";
    if ("u64" in t) return "u64";
    if ("u128" in t) return "u128";
    if ("u256" in t) return "u256";
    if ("address" in t) return "address";
    if ("signer" in t) return "signer";
    if ("vector" in t) return `vector<${xt.tagToString(t.vector)}>`;
    if ("struct" in t) {
      const n = t.struct, a = n.typeParams.map(xt.tagToString).join(", ");
      return `${n.address}::${n.module}::${n.name}${a ? `<${a}>` : ""}`;
    }
    throw new Error("Invalid TypeTag");
  }
};
function V6(e) {
  return f.u64({
    name: "unsafe_u64",
    ...e
  }).transform({
    input: (t) => t,
    output: (t) => Number(t)
  });
}
function F6(e) {
  return f.enum("Option", {
    None: null,
    Some: e
  });
}
const e0 = f.bytes(la).transform({
  validate: (e) => {
    const t = typeof e == "string" ? e : Qe(e);
    if (!t || !cn(H(t))) throw new Error(`Invalid Sui address ${t}`);
  },
  input: (e) => typeof e == "string" ? Ns(H(e)) : e,
  output: (e) => H(Qe(e))
}), x0 = f.byteVector().transform({
  name: "ObjectDigest",
  input: (e) => rn(e),
  output: (e) => Tn(new Uint8Array(e)),
  validate: (e) => {
    if (rn(e).length !== 32) throw new Error("ObjectDigest must be 32 bytes");
  }
}), ie = f.struct("SuiObjectRef", {
  objectId: e0,
  version: f.u64(),
  digest: x0
}), Oc = f.struct("SharedObjectRef", {
  objectId: e0,
  initialSharedVersion: f.u64(),
  mutable: f.bool()
}), Ec = f.enum("ObjectArg", {
  ImmOrOwnedObject: ie,
  SharedObject: Oc,
  Receiving: ie
}), ze = f.enum("Owner", {
  AddressOwner: e0,
  ObjectOwner: e0,
  Shared: f.struct("Shared", { initialSharedVersion: f.u64() }),
  Immutable: null,
  ConsensusAddressOwner: f.struct("ConsensusAddressOwner", {
    startVersion: f.u64(),
    owner: e0
  })
}), $6 = f.enum("Reservation", { MaxAmountU64: f.u64() }), L6 = f.enum("WithdrawalType", { Balance: f.lazy(() => Et) }), z6 = f.enum("WithdrawFrom", {
  Sender: null,
  Sponsor: null
}), G6 = f.struct("FundsWithdrawal", {
  reservation: $6,
  typeArg: L6,
  withdrawFrom: z6
}), Sc = f.enum("CallArg", {
  Pure: f.struct("Pure", { bytes: f.byteVector().transform({
    input: (e) => typeof e == "string" ? ae(e) : e,
    output: (e) => Q0(new Uint8Array(e))
  }) }),
  Object: Ec,
  FundsWithdrawal: G6
}), Bs = f.enum("TypeTag", {
  bool: null,
  u8: null,
  u64: null,
  u128: null,
  address: null,
  signer: null,
  vector: f.lazy(() => Bs),
  struct: f.lazy(() => js),
  u16: null,
  u32: null,
  u256: null
}), Et = Bs.transform({
  input: (e) => typeof e == "string" ? Ft.parseFromStr(e, !0) : e,
  output: (e) => Ft.tagToString(e)
}), Te = f.enum("Argument", {
  GasCoin: null,
  Input: f.u16(),
  Result: f.u16(),
  NestedResult: f.tuple([f.u16(), f.u16()])
}), kc = f.struct("ProgrammableMoveCall", {
  package: e0,
  module: f.string(),
  function: f.string(),
  typeArguments: f.vector(Et),
  arguments: f.vector(Te)
}), Nc = f.enum("Command", {
  MoveCall: kc,
  TransferObjects: f.struct("TransferObjects", {
    objects: f.vector(Te),
    address: Te
  }),
  SplitCoins: f.struct("SplitCoins", {
    coin: Te,
    amounts: f.vector(Te)
  }),
  MergeCoins: f.struct("MergeCoins", {
    destination: Te,
    sources: f.vector(Te)
  }),
  Publish: f.struct("Publish", {
    modules: f.vector(f.byteVector().transform({
      input: (e) => typeof e == "string" ? ae(e) : e,
      output: (e) => Q0(new Uint8Array(e))
    })),
    dependencies: f.vector(e0)
  }),
  MakeMoveVec: f.struct("MakeMoveVec", {
    type: F6(Et).transform({
      input: (e) => e === null ? { None: !0 } : { Some: e },
      output: (e) => e.Some ?? null
    }),
    elements: f.vector(Te)
  }),
  Upgrade: f.struct("Upgrade", {
    modules: f.vector(f.byteVector().transform({
      input: (e) => typeof e == "string" ? ae(e) : e,
      output: (e) => Q0(new Uint8Array(e))
    })),
    dependencies: f.vector(e0),
    package: e0,
    ticket: Te
  })
}), ss = f.struct("ProgrammableTransaction", {
  inputs: f.vector(Sc),
  commands: f.vector(Nc)
}), W6 = f.struct("ValidDuring", {
  minEpoch: f.option(f.u64()),
  maxEpoch: f.option(f.u64()),
  minTimestamp: f.option(f.u64()),
  maxTimestamp: f.option(f.u64()),
  chain: x0,
  nonce: f.u32()
}), Cc = f.enum("TransactionExpiration", {
  None: null,
  Epoch: V6(),
  ValidDuring: W6
}), js = f.struct("StructTag", {
  address: e0,
  module: f.string(),
  name: f.string(),
  typeParams: f.vector(Bs)
}), xc = f.struct("GasData", {
  payment: f.vector(ie),
  owner: e0,
  price: f.u64(),
  budget: f.u64()
}), _c = f.enum("IntentScope", {
  TransactionData: null,
  TransactionEffects: null,
  CheckpointSummary: null,
  PersonalMessage: null
}), Bc = f.enum("IntentVersion", { V0: null }), jc = f.enum("AppId", { Sui: null }), Mc = f.struct("Intent", {
  scope: _c,
  version: Bc,
  appId: jc
});
function Rc(e) {
  return f.struct(`IntentMessage<${e.name}>`, {
    intent: Mc,
    value: e
  });
}
const Dc = f.enum("CompressedSignature", {
  ED25519: f.bytes(64),
  Secp256k1: f.bytes(64),
  Secp256r1: f.bytes(64),
  ZkLogin: f.byteVector(),
  Passkey: f.byteVector()
}), Uc = f.enum("PublicKey", {
  ED25519: f.bytes(32),
  Secp256k1: f.bytes(33),
  Secp256r1: f.bytes(33),
  ZkLogin: f.byteVector(),
  Passkey: f.bytes(33)
}), Pc = f.struct("MultiSigPkMap", {
  pubKey: Uc,
  weight: f.u8()
}), Vc = f.struct("MultiSigPublicKey", {
  pk_map: f.vector(Pc),
  threshold: f.u16()
}), Q6 = f.struct("MultiSig", {
  sigs: f.vector(Dc),
  bitmap: f.u16(),
  multisig_pk: Vc
}), J6 = f.byteVector().transform({
  input: (e) => typeof e == "string" ? ae(e) : e,
  output: (e) => Q0(new Uint8Array(e))
}), Y6 = f.struct("PasskeyAuthenticator", {
  authenticatorData: f.byteVector(),
  clientDataJson: f.string(),
  userSignature: f.byteVector()
}), Fc = f.enum("MoveObjectType", {
  Other: js,
  GasCoin: null,
  StakedSui: null,
  Coin: Et,
  AccumulatorBalanceWrapper: null
}), $c = f.struct("TypeOrigin", {
  moduleName: f.string(),
  datatypeName: f.string(),
  package: e0
}), Lc = f.struct("UpgradeInfo", {
  upgradedId: e0,
  upgradedVersion: f.u64()
}), zc = f.struct("MovePackage", {
  id: e0,
  version: f.u64(),
  moduleMap: f.map(f.string(), f.byteVector()),
  typeOriginTable: f.vector($c),
  linkageTable: f.map(e0, Lc)
}), Gc = f.struct("MoveObject", {
  type: Fc,
  hasPublicTransfer: f.bool(),
  version: f.u64(),
  contents: f.byteVector()
}), Ms = f.enum("Data", {
  Move: Gc,
  Package: zc
}), Z6 = f.struct("ObjectInner", {
  data: Ms,
  owner: ze,
  previousTransaction: x0,
  storageRebate: f.u64()
}), Wc = f.struct("ChangeEpoch", {
  epoch: f.u64(),
  protocolVersion: f.u64(),
  storageCharge: f.u64(),
  computationCharge: f.u64(),
  storageRebate: f.u64(),
  nonRefundableStorageFee: f.u64(),
  epochStartTimestampMs: f.u64(),
  systemPackages: f.vector(f.tuple([
    f.u64(),
    f.vector(f.byteVector()),
    f.vector(e0)
  ]))
}), H6 = f.enum("GenesisObject", { RawObject: f.struct("RawObject", {
  data: Ms,
  owner: ze
}) }), q6 = f.struct("GenesisTransaction", { objects: f.vector(H6) }), X6 = f.struct("ConsensusCommitPrologue", {
  epoch: f.u64(),
  round: f.u64(),
  commitTimestampMs: f.u64()
}), K6 = f.struct("ConsensusCommitPrologueV2", {
  epoch: f.u64(),
  round: f.u64(),
  commitTimestampMs: f.u64(),
  consensusCommitDigest: x0
}), Qc = f.enum("ConsensusDeterminedVersionAssignments", {
  CancelledTransactions: f.vector(f.tuple([x0, f.vector(f.tuple([e0, f.u64()]))])),
  CancelledTransactionsV2: f.vector(f.tuple([x0, f.vector(f.tuple([f.tuple([e0, f.u64()]), f.u64()]))]))
}), e5 = f.struct("ConsensusCommitPrologueV3", {
  epoch: f.u64(),
  round: f.u64(),
  subDagIndex: f.option(f.u64()),
  commitTimestampMs: f.u64(),
  consensusCommitDigest: x0,
  consensusDeterminedVersionAssignments: Qc
}), t5 = f.struct("ConsensusCommitPrologueV4", {
  epoch: f.u64(),
  round: f.u64(),
  subDagIndex: f.option(f.u64()),
  commitTimestampMs: f.u64(),
  consensusCommitDigest: x0,
  consensusDeterminedVersionAssignments: Qc,
  additionalStateDigest: x0
}), n5 = f.struct("ActiveJwk", {
  jwkId: f.struct("JwkId", {
    iss: f.string(),
    kid: f.string()
  }),
  jwk: f.struct("JWK", {
    kty: f.string(),
    e: f.string(),
    n: f.string(),
    alg: f.string()
  }),
  epoch: f.u64()
}), a5 = f.struct("AuthenticatorStateUpdate", {
  epoch: f.u64(),
  round: f.u64(),
  newActiveJwks: f.vector(n5),
  authenticatorObjInitialSharedVersion: f.u64()
}), s5 = f.struct("RandomnessStateUpdate", {
  epoch: f.u64(),
  randomnessRound: f.u64(),
  randomBytes: f.byteVector(),
  randomnessObjInitialSharedVersion: f.u64()
}), r5 = f.struct("AuthenticatorStateExpire", {
  minEpoch: f.u64(),
  authenticatorObjInitialSharedVersion: f.u64()
}), i5 = f.enum("ExecutionTimeObservationKey", {
  MoveEntryPoint: f.struct("MoveEntryPoint", {
    package: e0,
    module: f.string(),
    function: f.string(),
    typeArguments: f.vector(Et)
  }),
  TransferObjects: null,
  SplitCoins: null,
  MergeCoins: null,
  Publish: null,
  MakeMoveVec: null,
  Upgrade: null
}), c5 = f.enum("StoredExecutionTimeObservations", { V1: f.vector(f.tuple([i5, f.vector(f.tuple([f.byteVector(), f.struct("Duration", {
  secs: f.u64(),
  nanos: f.u32()
})]))])) }), o5 = f.struct("WriteAccumulatorStorageCost", { storageCost: f.u64() }), d5 = f.enum("EndOfEpochTransactionKind", {
  ChangeEpoch: Wc,
  AuthenticatorStateCreate: null,
  AuthenticatorStateExpire: r5,
  RandomnessStateCreate: null,
  DenyListStateCreate: null,
  BridgeStateCreate: x0,
  BridgeCommitteeInit: f.u64(),
  StoreExecutionTimeObservations: c5,
  AccumulatorRootCreate: null,
  CoinRegistryCreate: null,
  DisplayRegistryCreate: null,
  AddressAliasStateCreate: null,
  WriteAccumulatorStorageCost: o5
}), Jc = f.enum("TransactionKind", {
  ProgrammableTransaction: ss,
  ChangeEpoch: Wc,
  Genesis: q6,
  ConsensusCommitPrologue: X6,
  AuthenticatorStateUpdate: a5,
  EndOfEpochTransaction: f.vector(d5),
  RandomnessStateUpdate: s5,
  ConsensusCommitPrologueV2: K6,
  ConsensusCommitPrologueV3: e5,
  ConsensusCommitPrologueV4: t5,
  ProgrammableSystemTransaction: ss
}), Yc = f.struct("TransactionDataV1", {
  kind: Jc,
  sender: e0,
  gasData: xc,
  expiration: Cc
}), Zc = f.enum("TransactionData", { V1: Yc }), Hc = f.struct("SenderSignedTransaction", {
  intentMessage: Rc(Zc),
  txSignatures: f.vector(J6)
}), f5 = f.vector(Hc, { name: "SenderSignedData" }), u5 = f.enum("PackageUpgradeError", {
  UnableToFetchPackage: f.struct("UnableToFetchPackage", { packageId: e0 }),
  NotAPackage: f.struct("NotAPackage", { objectId: e0 }),
  IncompatibleUpgrade: null,
  DigestDoesNotMatch: f.struct("DigestDoesNotMatch", { digest: f.byteVector() }),
  UnknownUpgradePolicy: f.struct("UnknownUpgradePolicy", { policy: f.u8() }),
  PackageIDDoesNotMatch: f.struct("PackageIDDoesNotMatch", {
    packageId: e0,
    ticketId: e0
  })
}), l5 = f.struct("ModuleId", {
  address: e0,
  name: f.string()
}), vr = f.struct("MoveLocation", {
  module: l5,
  function: f.u16(),
  instruction: f.u16(),
  functionName: f.option(f.string())
}), b5 = f.enum("CommandArgumentError", {
  TypeMismatch: null,
  InvalidBCSBytes: null,
  InvalidUsageOfPureArg: null,
  InvalidArgumentToPrivateEntryFunction: null,
  IndexOutOfBounds: f.struct("IndexOutOfBounds", { idx: f.u16() }),
  SecondaryIndexOutOfBounds: f.struct("SecondaryIndexOutOfBounds", {
    resultIdx: f.u16(),
    secondaryIdx: f.u16()
  }),
  InvalidResultArity: f.struct("InvalidResultArity", { resultIdx: f.u16() }),
  InvalidGasCoinUsage: null,
  InvalidValueUsage: null,
  InvalidObjectByValue: null,
  InvalidObjectByMutRef: null,
  SharedObjectOperationNotAllowed: null,
  InvalidArgumentArity: null,
  InvalidTransferObject: null,
  InvalidMakeMoveVecNonObjectArgument: null,
  ArgumentWithoutValue: null,
  CannotMoveBorrowedValue: null,
  CannotWriteToExtendedReference: null,
  InvalidReferenceArgument: null
}), p5 = f.enum("TypeArgumentError", {
  TypeNotFound: null,
  ConstraintNotSatisfied: null
}), m5 = f.enum("ExecutionFailureStatus", {
  InsufficientGas: null,
  InvalidGasObject: null,
  InvariantViolation: null,
  FeatureNotYetSupported: null,
  MoveObjectTooBig: f.struct("MoveObjectTooBig", {
    objectSize: f.u64(),
    maxObjectSize: f.u64()
  }),
  MovePackageTooBig: f.struct("MovePackageTooBig", {
    objectSize: f.u64(),
    maxObjectSize: f.u64()
  }),
  CircularObjectOwnership: f.struct("CircularObjectOwnership", { object: e0 }),
  InsufficientCoinBalance: null,
  CoinBalanceOverflow: null,
  PublishErrorNonZeroAddress: null,
  SuiMoveVerificationError: null,
  MovePrimitiveRuntimeError: f.option(vr),
  MoveAbort: f.tuple([vr, f.u64()]),
  VMVerificationOrDeserializationError: null,
  VMInvariantViolation: null,
  FunctionNotFound: null,
  ArityMismatch: null,
  TypeArityMismatch: null,
  NonEntryFunctionInvoked: null,
  CommandArgumentError: f.struct("CommandArgumentError", {
    argIdx: f.u16(),
    kind: b5
  }),
  TypeArgumentError: f.struct("TypeArgumentError", {
    argumentIdx: f.u16(),
    kind: p5
  }),
  UnusedValueWithoutDrop: f.struct("UnusedValueWithoutDrop", {
    resultIdx: f.u16(),
    secondaryIdx: f.u16()
  }),
  InvalidPublicFunctionReturnType: f.struct("InvalidPublicFunctionReturnType", { idx: f.u16() }),
  InvalidTransferObject: null,
  EffectsTooLarge: f.struct("EffectsTooLarge", {
    currentSize: f.u64(),
    maxSize: f.u64()
  }),
  PublishUpgradeMissingDependency: null,
  PublishUpgradeDependencyDowngrade: null,
  PackageUpgradeError: f.struct("PackageUpgradeError", { upgradeError: u5 }),
  WrittenObjectsTooLarge: f.struct("WrittenObjectsTooLarge", {
    currentSize: f.u64(),
    maxSize: f.u64()
  }),
  CertificateDenied: null,
  SuiMoveVerificationTimedout: null,
  SharedObjectOperationNotAllowed: null,
  InputObjectDeleted: null,
  ExecutionCancelledDueToSharedObjectCongestion: f.struct("ExecutionCancelledDueToSharedObjectCongestion", { congested_objects: f.vector(e0) }),
  AddressDeniedForCoin: f.struct("AddressDeniedForCoin", {
    address: e0,
    coinType: f.string()
  }),
  CoinTypeGlobalPause: f.struct("CoinTypeGlobalPause", { coinType: f.string() }),
  ExecutionCancelledDueToRandomnessUnavailable: null,
  MoveVectorElemTooBig: f.struct("MoveVectorElemTooBig", {
    valueSize: f.u64(),
    maxScaledSize: f.u64()
  }),
  MoveRawValueTooBig: f.struct("MoveRawValueTooBig", {
    valueSize: f.u64(),
    maxScaledSize: f.u64()
  }),
  InvalidLinkage: null,
  InsufficientBalanceForWithdraw: null,
  NonExclusiveWriteInputObjectModified: f.struct("NonExclusiveWriteInputObjectModified", { id: e0 })
}), Rs = f.enum("ExecutionStatus", {
  Success: null,
  Failure: f.struct("Failure", {
    error: m5,
    command: f.option(f.u64())
  })
}), qc = f.struct("GasCostSummary", {
  computationCost: f.u64(),
  storageCost: f.u64(),
  storageRebate: f.u64(),
  nonRefundableStorageFee: f.u64()
}), g5 = f.struct("TransactionEffectsV1", {
  status: Rs,
  executedEpoch: f.u64(),
  gasUsed: qc,
  modifiedAtVersions: f.vector(f.tuple([e0, f.u64()])),
  sharedObjects: f.vector(ie),
  transactionDigest: x0,
  created: f.vector(f.tuple([ie, ze])),
  mutated: f.vector(f.tuple([ie, ze])),
  unwrapped: f.vector(f.tuple([ie, ze])),
  deleted: f.vector(ie),
  unwrappedThenDeleted: f.vector(ie),
  wrapped: f.vector(ie),
  gasObject: f.tuple([ie, ze]),
  eventsDigest: f.option(x0),
  dependencies: f.vector(x0)
}), Ds = f.tuple([f.u64(), x0]), h5 = f.enum("ObjectIn", {
  NotExist: null,
  Exist: f.tuple([Ds, ze])
}), A5 = f.struct("AccumulatorAddress", {
  address: e0,
  ty: Et
}), y5 = f.enum("AccumulatorOperation", {
  Merge: null,
  Split: null
}), w5 = f.enum("AccumulatorValue", {
  Integer: f.u64(),
  IntegerTuple: f.tuple([f.u64(), f.u64()]),
  EventDigest: f.vector(f.tuple([f.u64(), x0]))
}), T5 = f.struct("AccumulatorWriteV1", {
  address: A5,
  operation: y5,
  value: w5
}), v5 = f.enum("ObjectOut", {
  NotExist: null,
  ObjectWrite: f.tuple([x0, ze]),
  PackageWrite: Ds,
  AccumulatorWriteV1: T5
}), I5 = f.enum("IDOperation", {
  None: null,
  Created: null,
  Deleted: null
}), O5 = f.struct("EffectsObjectChange", {
  inputState: h5,
  outputState: v5,
  idOperation: I5
}), E5 = f.enum("UnchangedConsensusKind", {
  ReadOnlyRoot: Ds,
  MutateConsensusStreamEnded: f.u64(),
  ReadConsensusStreamEnded: f.u64(),
  Cancelled: f.u64(),
  PerEpochConfig: null
}), S5 = f.struct("TransactionEffectsV2", {
  status: Rs,
  executedEpoch: f.u64(),
  gasUsed: qc,
  transactionDigest: x0,
  gasObjectIndex: f.option(f.u32()),
  eventsDigest: f.option(x0),
  dependencies: f.vector(x0),
  lamportVersion: f.u64(),
  changedObjects: f.vector(f.tuple([e0, O5])),
  unchangedConsensusObjects: f.vector(f.tuple([e0, E5])),
  auxDataDigest: f.option(x0)
}), k5 = f.enum("TransactionEffects", {
  V1: g5,
  V2: S5
});
function qt(e) {
  switch (e) {
    case "u8":
      return f.u8();
    case "u16":
      return f.u16();
    case "u32":
      return f.u32();
    case "u64":
      return f.u64();
    case "u128":
      return f.u128();
    case "u256":
      return f.u256();
    case "bool":
      return f.bool();
    case "string":
      return f.string();
    case "id":
    case "address":
      return e0;
  }
  const t = e.match(/^(vector|option)<(.+)>$/);
  if (t) {
    const [n, a] = t.slice(1);
    return n === "vector" ? f.vector(qt(a)) : f.option(qt(a));
  }
  throw new Error(`Invalid Pure type name: ${e}`);
}
const A = {
  ...f,
  U8: f.u8(),
  U16: f.u16(),
  U32: f.u32(),
  U64: f.u64(),
  U128: f.u128(),
  U256: f.u256(),
  ULEB128: f.uleb128(),
  Bool: f.bool(),
  String: f.string(),
  Address: e0,
  AppId: jc,
  Argument: Te,
  CallArg: Sc,
  Command: Nc,
  CompressedSignature: Dc,
  Data: Ms,
  GasData: xc,
  Intent: Mc,
  IntentMessage: Rc,
  IntentScope: _c,
  IntentVersion: Bc,
  MoveObject: Gc,
  MoveObjectType: Fc,
  MovePackage: zc,
  MultiSig: Q6,
  MultiSigPkMap: Pc,
  MultiSigPublicKey: Vc,
  Object: Z6,
  ObjectArg: Ec,
  ObjectDigest: x0,
  Owner: ze,
  PasskeyAuthenticator: Y6,
  ProgrammableMoveCall: kc,
  ProgrammableTransaction: ss,
  PublicKey: Uc,
  SenderSignedData: f5,
  SenderSignedTransaction: Hc,
  SharedObjectRef: Oc,
  StructTag: js,
  SuiObjectRef: ie,
  TransactionData: Zc,
  TransactionDataV1: Yc,
  TransactionEffects: k5,
  TransactionExpiration: Cc,
  TransactionKind: Jc,
  TypeOrigin: $c,
  TypeTag: Et,
  UpgradeInfo: Lc
}, Ir = /* @__PURE__ */ U({
  digest: /* @__PURE__ */ i0(),
  objectId: /* @__PURE__ */ i0(),
  version: /* @__PURE__ */ fe([
    /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0()),
    /* @__PURE__ */ i0(),
    /* @__PURE__ */ xs()
  ])
}), N5 = xe({
  ImmOrOwned: Ir,
  Shared: /* @__PURE__ */ U({
    objectId: se,
    initialSharedVersion: M0,
    mutable: /* @__PURE__ */ Vt()
  }),
  Receiving: Ir
}), Or = xe({
  Object: N5,
  Pure: /* @__PURE__ */ n0(/* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0()))
});
function C5(e) {
  var n;
  const t = e.inputs.map((a, s) => {
    if (a.Object) return {
      kind: "Input",
      index: s,
      value: { Object: a.Object.ImmOrOwnedObject ? { ImmOrOwned: a.Object.ImmOrOwnedObject } : a.Object.Receiving ? { Receiving: {
        digest: a.Object.Receiving.digest,
        version: a.Object.Receiving.version,
        objectId: a.Object.Receiving.objectId
      } } : { Shared: {
        mutable: a.Object.SharedObject.mutable,
        initialSharedVersion: a.Object.SharedObject.initialSharedVersion,
        objectId: a.Object.SharedObject.objectId
      } } },
      type: "object"
    };
    if (a.Pure) return {
      kind: "Input",
      index: s,
      value: { Pure: Array.from(ae(a.Pure.bytes)) },
      type: "pure"
    };
    if (a.UnresolvedPure) return {
      kind: "Input",
      type: "pure",
      index: s,
      value: a.UnresolvedPure.value
    };
    if (a.UnresolvedObject) return {
      kind: "Input",
      type: "object",
      index: s,
      value: a.UnresolvedObject.objectId
    };
    throw new Error("Invalid input");
  });
  return {
    version: 1,
    sender: e.sender ?? void 0,
    expiration: ((n = e.expiration) == null ? void 0 : n.$kind) === "Epoch" ? { Epoch: Number(e.expiration.Epoch) } : e.expiration ? { None: !0 } : null,
    gasConfig: {
      owner: e.gasData.owner ?? void 0,
      budget: e.gasData.budget ?? void 0,
      price: e.gasData.price ?? void 0,
      payment: e.gasData.payment ?? void 0
    },
    inputs: t,
    transactions: e.commands.map((a) => {
      if (a.MakeMoveVec) return {
        kind: "MakeMoveVec",
        type: a.MakeMoveVec.type === null ? { None: !0 } : { Some: Ft.parseFromStr(a.MakeMoveVec.type) },
        objects: a.MakeMoveVec.elements.map((s) => Be(s, t))
      };
      if (a.MergeCoins) return {
        kind: "MergeCoins",
        destination: Be(a.MergeCoins.destination, t),
        sources: a.MergeCoins.sources.map((s) => Be(s, t))
      };
      if (a.MoveCall) return {
        kind: "MoveCall",
        target: `${a.MoveCall.package}::${a.MoveCall.module}::${a.MoveCall.function}`,
        typeArguments: a.MoveCall.typeArguments,
        arguments: a.MoveCall.arguments.map((s) => Be(s, t))
      };
      if (a.Publish) return {
        kind: "Publish",
        modules: a.Publish.modules.map((s) => Array.from(ae(s))),
        dependencies: a.Publish.dependencies
      };
      if (a.SplitCoins) return {
        kind: "SplitCoins",
        coin: Be(a.SplitCoins.coin, t),
        amounts: a.SplitCoins.amounts.map((s) => Be(s, t))
      };
      if (a.TransferObjects) return {
        kind: "TransferObjects",
        objects: a.TransferObjects.objects.map((s) => Be(s, t)),
        address: Be(a.TransferObjects.address, t)
      };
      if (a.Upgrade) return {
        kind: "Upgrade",
        modules: a.Upgrade.modules.map((s) => Array.from(ae(s))),
        dependencies: a.Upgrade.dependencies,
        packageId: a.Upgrade.package,
        ticket: Be(a.Upgrade.ticket, t)
      };
      throw new Error(`Unknown transaction ${Object.keys(a)}`);
    })
  };
}
function Be(e, t) {
  if (e.$kind === "GasCoin") return { kind: "GasCoin" };
  if (e.$kind === "Result") return {
    kind: "Result",
    index: e.Result
  };
  if (e.$kind === "NestedResult") return {
    kind: "NestedResult",
    index: e.NestedResult[0],
    resultIndex: e.NestedResult[1]
  };
  if (e.$kind === "Input") return t[e.Input];
  throw new Error(`Invalid argument ${Object.keys(e)}`);
}
function x5(e) {
  var t, n, a;
  return y0(Dn, {
    version: 2,
    sender: e.sender ?? null,
    expiration: e.expiration ? "Epoch" in e.expiration ? { Epoch: e.expiration.Epoch } : { None: !0 } : null,
    gasData: {
      owner: e.gasConfig.owner ?? null,
      budget: ((t = e.gasConfig.budget) == null ? void 0 : t.toString()) ?? null,
      price: ((n = e.gasConfig.price) == null ? void 0 : n.toString()) ?? null,
      payment: ((a = e.gasConfig.payment) == null ? void 0 : a.map((s) => ({
        digest: s.digest,
        objectId: s.objectId,
        version: s.version.toString()
      }))) ?? null
    },
    inputs: e.inputs.map((s) => {
      if (s.kind === "Input") {
        if (/* @__PURE__ */ ts(Or, s.value)) {
          const r = y0(Or, s.value);
          if (r.Object) {
            if (r.Object.ImmOrOwned) return { Object: { ImmOrOwnedObject: {
              objectId: r.Object.ImmOrOwned.objectId,
              version: String(r.Object.ImmOrOwned.version),
              digest: r.Object.ImmOrOwned.digest
            } } };
            if (r.Object.Shared) return { Object: { SharedObject: {
              mutable: r.Object.Shared.mutable ?? null,
              initialSharedVersion: r.Object.Shared.initialSharedVersion,
              objectId: r.Object.Shared.objectId
            } } };
            if (r.Object.Receiving) return { Object: { Receiving: {
              digest: r.Object.Receiving.digest,
              version: String(r.Object.Receiving.version),
              objectId: r.Object.Receiving.objectId
            } } };
            throw new Error("Invalid object input");
          }
          return { Pure: { bytes: Q0(new Uint8Array(r.Pure)) } };
        }
        return s.type === "object" ? { UnresolvedObject: { objectId: s.value } } : { UnresolvedPure: { value: s.value } };
      }
      throw new Error("Invalid input");
    }),
    commands: e.transactions.map((s) => {
      switch (s.kind) {
        case "MakeMoveVec":
          return { MakeMoveVec: {
            type: "Some" in s.type ? Ft.tagToString(s.type.Some) : null,
            elements: s.objects.map((r) => je(r))
          } };
        case "MergeCoins":
          return { MergeCoins: {
            destination: je(s.destination),
            sources: s.sources.map((r) => je(r))
          } };
        case "MoveCall": {
          const [r, i, c] = s.target.split("::");
          return { MoveCall: {
            package: r,
            module: i,
            function: c,
            typeArguments: s.typeArguments,
            arguments: s.arguments.map((o) => je(o))
          } };
        }
        case "Publish":
          return { Publish: {
            modules: s.modules.map((r) => Q0(Uint8Array.from(r))),
            dependencies: s.dependencies
          } };
        case "SplitCoins":
          return { SplitCoins: {
            coin: je(s.coin),
            amounts: s.amounts.map((r) => je(r))
          } };
        case "TransferObjects":
          return { TransferObjects: {
            objects: s.objects.map((r) => je(r)),
            address: je(s.address)
          } };
        case "Upgrade":
          return { Upgrade: {
            modules: s.modules.map((r) => Q0(Uint8Array.from(r))),
            dependencies: s.dependencies,
            package: s.packageId,
            ticket: je(s.ticket)
          } };
      }
      throw new Error(`Unknown transaction ${Object.keys(s)}`);
    })
  });
}
function je(e) {
  switch (e.kind) {
    case "GasCoin":
      return { GasCoin: !0 };
    case "Result":
      return { Result: e.index };
    case "NestedResult":
      return { NestedResult: [e.index, e.resultIndex] };
    case "Input":
      return { Input: e.index };
  }
}
function Er(e) {
  return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in e && e.BYTES_PER_ELEMENT === 1;
}
const rs = (e) => e ? `"${e}" ` : "";
function Zn(e, t = "") {
  if (typeof e != "number")
    throw new TypeError(rs(t) + "expected number, got " + typeof e);
  if (!Number.isSafeInteger(e) || e < 0)
    throw new RangeError(rs(t) + "expected integer >= 0, got " + e);
  return e;
}
function rt(e, t, n = "") {
  if (Er(e) && (t === void 0 || e.length === t))
    return e;
  t !== void 0 && Zn(t, "length");
  const a = Er(e), s = t !== void 0 ? ` of length ${t}` : "", r = a ? `length=${e.length}` : `type=${typeof e}`, i = rs(n) + "expected Uint8Array" + s + ", got " + r;
  throw a ? new RangeError(i) : new TypeError(i);
}
function Sr(e) {
  return Uint8Array.from(rt(e));
}
const kr = (e, t) => {
  if (e === null || typeof e != "object" || Array.isArray(e))
    throw new TypeError((t === "object" ? "" : `"${t}" `) + "expected object, got type=" + typeof e);
};
function Nr(e, t = !0) {
  if (e.destroyed)
    throw new Error("hash was destroyed");
  if (t && e.finished)
    throw new Error("digest() was already called");
}
function _5(e, t) {
  rt(e, void 0, "output");
  const n = t.outputLen;
  if (!(e.length >= n))
    throw new RangeError('"output" expected length >= ' + n);
}
function Hn(e) {
  return new Uint32Array(e.buffer, e.byteOffset, Math.floor(e.byteLength / 4));
}
function ja(...e) {
  for (let t = 0; t < e.length; t++)
    e[t].fill(0);
}
const Xc = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
function Kc(e) {
  return e << 24 & 4278190080 | e << 8 & 16711680 | e >>> 8 & 65280 | e >>> 24 & 255;
}
const Ue = Xc ? (e) => e : (e) => Kc(e) >>> 0;
function B5(e) {
  for (let t = 0; t < e.length; t++)
    e[t] = Kc(e[t]);
  return e;
}
const kt = Xc ? (e) => e : B5;
function eo(e, t, n = "opts") {
  return kr(e, "defaults"), t !== void 0 && kr(t, n), Object.assign(e, t);
}
function j5(e, t = {}) {
  if (typeof e != "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof e);
  t = eo({}, t, "info");
  const n = (s, r) => e(r).update(s).digest(), a = e(void 0);
  return n.outputLen = a.outputLen, n.blockLen = a.blockLen, n.canXOF = a.canXOF, n.create = (s) => e(s), Object.assign(n, t), Object.freeze(n);
}
const M5 = /* @__PURE__ */ Uint8Array.from([
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  14,
  10,
  4,
  8,
  9,
  15,
  13,
  6,
  1,
  12,
  0,
  2,
  11,
  7,
  5,
  3,
  11,
  8,
  12,
  0,
  5,
  2,
  15,
  13,
  10,
  14,
  3,
  6,
  7,
  1,
  9,
  4,
  7,
  9,
  3,
  1,
  13,
  12,
  11,
  14,
  2,
  6,
  5,
  10,
  4,
  0,
  15,
  8,
  9,
  0,
  5,
  7,
  2,
  4,
  10,
  15,
  14,
  1,
  11,
  12,
  6,
  8,
  3,
  13,
  2,
  12,
  6,
  10,
  0,
  11,
  8,
  3,
  4,
  13,
  7,
  5,
  15,
  14,
  1,
  9,
  12,
  5,
  1,
  15,
  14,
  13,
  4,
  10,
  0,
  7,
  6,
  3,
  9,
  2,
  8,
  11,
  13,
  11,
  7,
  14,
  12,
  1,
  3,
  9,
  5,
  0,
  15,
  4,
  8,
  6,
  2,
  10,
  6,
  15,
  14,
  9,
  11,
  3,
  0,
  8,
  12,
  2,
  13,
  7,
  1,
  4,
  10,
  5,
  10,
  2,
  8,
  4,
  7,
  6,
  1,
  5,
  15,
  11,
  9,
  14,
  3,
  12,
  13,
  0,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  14,
  10,
  4,
  8,
  9,
  15,
  13,
  6,
  1,
  12,
  0,
  2,
  11,
  7,
  5,
  3,
  // Blake1, unused in others
  11,
  8,
  12,
  0,
  5,
  2,
  15,
  13,
  10,
  14,
  3,
  6,
  7,
  1,
  9,
  4,
  7,
  9,
  3,
  1,
  13,
  12,
  11,
  14,
  2,
  6,
  5,
  10,
  4,
  0,
  15,
  8,
  9,
  0,
  5,
  7,
  2,
  4,
  10,
  15,
  14,
  1,
  11,
  12,
  6,
  8,
  3,
  13,
  2,
  12,
  6,
  10,
  0,
  11,
  8,
  3,
  4,
  13,
  7,
  5,
  15,
  14,
  1,
  9
]), R5 = (e) => e / 2 ** 32 | 0, D5 = (e) => e >>> 0, to = (e, t, n) => e >>> n | t << 32 - n, no = (e, t, n) => e << 32 - n | t >>> n, U5 = (e, t, n) => e << 64 - n | t >>> n - 32, P5 = (e, t, n) => e >>> n - 32 | t << 64 - n, V5 = (e, t) => t, F5 = (e, t) => e;
function ao(e, t, n, a) {
  const s = (t >>> 0) + (a >>> 0);
  return { h: e + n + (s / 2 ** 32 | 0) | 0, l: s | 0 };
}
const so = (e, t, n) => (e >>> 0) + (t >>> 0) + (n >>> 0), ro = (e, t, n, a) => t + n + a + (e / 2 ** 32 | 0) | 0, B0 = /* @__PURE__ */ Uint32Array.from([
  4089235720,
  1779033703,
  2227873595,
  3144134277,
  4271175723,
  1013904242,
  1595750129,
  2773480762,
  2917565137,
  1359893119,
  725511199,
  2600822924,
  4215389547,
  528734635,
  327033209,
  1541459225
]), S = /* @__PURE__ */ new Uint32Array(32);
function Ze(e, t, n, a, s, r) {
  const i = s[r], c = s[r + 1];
  let o = S[2 * e], d = S[2 * e + 1], u = S[2 * t], l = S[2 * t + 1], b = S[2 * n], p = S[2 * n + 1], m = S[2 * a], h = S[2 * a + 1];
  const y = so(o, u, i);
  d = ro(y, d, l, c), o = y | 0;
  let w = h ^ d, I = m ^ o;
  h = V5(w, I), m = F5(w), { h: p, l: b } = ao(p, b, h, m), w = l ^ p, I = u ^ b, l = to(w, I, 24), u = no(w, I, 24), S[2 * e] = o, S[2 * e + 1] = d, S[2 * t] = u, S[2 * t + 1] = l, S[2 * n] = b, S[2 * n + 1] = p, S[2 * a] = m, S[2 * a + 1] = h;
}
function He(e, t, n, a, s, r) {
  const i = s[r], c = s[r + 1];
  let o = S[2 * e], d = S[2 * e + 1], u = S[2 * t], l = S[2 * t + 1], b = S[2 * n], p = S[2 * n + 1], m = S[2 * a], h = S[2 * a + 1];
  const y = so(o, u, i);
  d = ro(y, d, l, c), o = y | 0;
  let w = h ^ d, I = m ^ o;
  h = to(w, I, 16), m = no(w, I, 16), { h: p, l: b } = ao(p, b, h, m), w = l ^ p, I = u ^ b, l = U5(w, I, 63), u = P5(w, I, 63), S[2 * e] = o, S[2 * e + 1] = d, S[2 * t] = u, S[2 * t + 1] = l, S[2 * n] = b, S[2 * n + 1] = p, S[2 * a] = m, S[2 * a + 1] = h;
}
function $5(e, t = {}, n, a, s) {
  if (Zn(n), e <= 0 || e > n)
    throw new Error('"dkLen" must be 1..' + n + ", got " + e);
  const { key: r, salt: i, personalization: c } = t;
  if (r !== void 0 && (r.length < 1 || r.length > n))
    throw new Error('"key" expected to be undefined or of length=1..' + n);
  i !== void 0 && rt(i, a, "salt"), c !== void 0 && rt(c, s, "personalization");
}
class L5 {
  constructor(t, n) {
    m0(this, "buffer");
    m0(this, "buffer32");
    m0(this, "finished", !1);
    m0(this, "destroyed", !1);
    m0(this, "length", 0);
    m0(this, "pos", 0);
    m0(this, "blockLen");
    m0(this, "outputLen");
    m0(this, "canXOF", !1);
    Zn(t), Zn(n), this.blockLen = t, this.outputLen = n, this.buffer = new Uint8Array(t), this.buffer32 = Hn(this.buffer);
  }
  update(t) {
    Nr(this), rt(t);
    const { blockLen: n, buffer: a, buffer32: s } = this, r = t.length, i = t.byteOffset, c = t.buffer;
    for (let o = 0; o < r; ) {
      this.pos === n && (kt(s), this.compress(s, 0, !1), kt(s), this.pos = 0);
      const d = Math.min(n - this.pos, r - o), u = i + o;
      if (d === n && !(u % 4) && o + d < r) {
        const l = new Uint32Array(c, u, Math.floor((r - o) / 4));
        kt(l);
        for (let b = 0; o + n < r; b += s.length, o += n)
          this.length += n, this.compress(l, b, !1);
        kt(l);
        continue;
      }
      a.set(o === 0 && d === r ? t : t.subarray(o, o + d), this.pos), this.pos += d, this.length += d, o += d;
    }
    return this;
  }
  digestInto(t) {
    if (Nr(this), _5(t, this), t.byteOffset & 3)
      throw new RangeError('"output" expected 4-byte aligned byteOffset, got ' + t.byteOffset);
    const { pos: n, buffer32: a } = this;
    this.finished = !0, this.buffer.fill(0, n), kt(a), this.compress(a, 0, !0), kt(a);
    const s = this.get(), r = t === this.buffer ? a : Hn(t), i = Math.floor(this.outputLen / 4);
    for (let u = 0; u < i; u++)
      r[u] = Ue(s[u]);
    const c = this.outputLen % 4;
    if (!c)
      return;
    const o = i * 4, d = s[i];
    for (let u = 0; u < c; u++)
      t[o + u] = d >>> 8 * u;
  }
  digest() {
    const { buffer: t, outputLen: n } = this;
    this.digestInto(t);
    const a = t.slice(0, n);
    return this.destroy(), a;
  }
  _cloneInto(t) {
    const { buffer: n, length: a, finished: s, destroyed: r, outputLen: i, pos: c } = this;
    return t || (t = new this.constructor({ dkLen: i })), t.set(...this.get()), t.buffer.set(n), t.destroyed = r, t.finished = s, t.length = a, t.pos = c, t.outputLen = i, t;
  }
  clone() {
    return this._cloneInto();
  }
}
class z5 extends L5 {
  constructor(n = {}) {
    n = eo({}, n);
    const a = n.dkLen === void 0 ? 64 : n.dkLen;
    super(128, a);
    // Same IV words as SHA-512 / BLAKE2b, encoded as LE u32 low/high halves.
    m0(this, "v0l", B0[0] | 0);
    m0(this, "v0h", B0[1] | 0);
    m0(this, "v1l", B0[2] | 0);
    m0(this, "v1h", B0[3] | 0);
    m0(this, "v2l", B0[4] | 0);
    m0(this, "v2h", B0[5] | 0);
    m0(this, "v3l", B0[6] | 0);
    m0(this, "v3h", B0[7] | 0);
    m0(this, "v4l", B0[8] | 0);
    m0(this, "v4h", B0[9] | 0);
    m0(this, "v5l", B0[10] | 0);
    m0(this, "v5h", B0[11] | 0);
    m0(this, "v6l", B0[12] | 0);
    m0(this, "v6h", B0[13] | 0);
    m0(this, "v7l", B0[14] | 0);
    m0(this, "v7h", B0[15] | 0);
    $5(a, n, 64, 16, 16);
    let { key: s, personalization: r, salt: i } = n, c = 0;
    if (s !== void 0 && (rt(s, void 0, "key"), c = s.length), this.v0l ^= this.outputLen | c << 8 | 65536 | 1 << 24, i !== void 0) {
      rt(i, void 0, "salt");
      const o = Hn(Sr(i));
      this.v4l ^= Ue(o[0]), this.v4h ^= Ue(o[1]), this.v5l ^= Ue(o[2]), this.v5h ^= Ue(o[3]);
    }
    if (r !== void 0) {
      rt(r, void 0, "personalization");
      const o = Hn(Sr(r));
      this.v6l ^= Ue(o[0]), this.v6h ^= Ue(o[1]), this.v7l ^= Ue(o[2]), this.v7h ^= Ue(o[3]);
    }
    if (s !== void 0) {
      const o = new Uint8Array(this.blockLen);
      o.set(s), this.update(o), ja(o);
    }
  }
  // prettier-ignore
  get() {
    let { v0l: n, v0h: a, v1l: s, v1h: r, v2l: i, v2h: c, v3l: o, v3h: d, v4l: u, v4h: l, v5l: b, v5h: p, v6l: m, v6h: h, v7l: y, v7h: w } = this;
    return [n, a, s, r, i, c, o, d, u, l, b, p, m, h, y, w];
  }
  // prettier-ignore
  set(n, a, s, r, i, c, o, d, u, l, b, p, m, h, y, w) {
    this.v0l = n | 0, this.v0h = a | 0, this.v1l = s | 0, this.v1h = r | 0, this.v2l = i | 0, this.v2h = c | 0, this.v3l = o | 0, this.v3h = d | 0, this.v4l = u | 0, this.v4h = l | 0, this.v5l = b | 0, this.v5h = p | 0, this.v6l = m | 0, this.v6h = h | 0, this.v7l = y | 0, this.v7h = w | 0;
  }
  compress(n, a, s) {
    const { v0l: r, v0h: i, v1l: c, v1h: o, v2l: d, v2h: u, v3l: l, v3h: b, v4l: p, v4h: m, v5l: h, v5h: y, v6l: w, v6h: I, v7l: C, v7h: R } = this;
    S[0] = r, S[1] = i, S[2] = c, S[3] = o, S[4] = d, S[5] = u, S[6] = l, S[7] = b, S[8] = p, S[9] = m, S[10] = h, S[11] = y, S[12] = w, S[13] = I, S[14] = C, S[15] = R, S.set(B0, 16);
    const F = D5(this.length), j = R5(this.length);
    S[24] = B0[8] ^ F, S[25] = B0[9] ^ j, s && (S[28] = ~S[28], S[29] = ~S[29]);
    let D = 0;
    const P = M5;
    for (let O = 0; O < 12; O++)
      Ze(0, 4, 8, 12, n, a + 2 * P[D++]), He(0, 4, 8, 12, n, a + 2 * P[D++]), Ze(1, 5, 9, 13, n, a + 2 * P[D++]), He(1, 5, 9, 13, n, a + 2 * P[D++]), Ze(2, 6, 10, 14, n, a + 2 * P[D++]), He(2, 6, 10, 14, n, a + 2 * P[D++]), Ze(3, 7, 11, 15, n, a + 2 * P[D++]), He(3, 7, 11, 15, n, a + 2 * P[D++]), Ze(0, 5, 10, 15, n, a + 2 * P[D++]), He(0, 5, 10, 15, n, a + 2 * P[D++]), Ze(1, 6, 11, 12, n, a + 2 * P[D++]), He(1, 6, 11, 12, n, a + 2 * P[D++]), Ze(2, 7, 8, 13, n, a + 2 * P[D++]), He(2, 7, 8, 13, n, a + 2 * P[D++]), Ze(3, 4, 9, 14, n, a + 2 * P[D++]), He(3, 4, 9, 14, n, a + 2 * P[D++]);
    this.v0l ^= S[0] ^ S[16], this.v0h ^= S[1] ^ S[17], this.v1l ^= S[2] ^ S[18], this.v1h ^= S[3] ^ S[19], this.v2l ^= S[4] ^ S[20], this.v2h ^= S[5] ^ S[21], this.v3l ^= S[6] ^ S[22], this.v3h ^= S[7] ^ S[23], this.v4l ^= S[8] ^ S[24], this.v4h ^= S[9] ^ S[25], this.v5l ^= S[10] ^ S[26], this.v5h ^= S[11] ^ S[27], this.v6l ^= S[12] ^ S[28], this.v6h ^= S[13] ^ S[29], this.v7l ^= S[14] ^ S[30], this.v7h ^= S[15] ^ S[31], ja(S);
  }
  destroy() {
    this.destroyed = !0, ja(this.buffer32), this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
}
const io = /* @__PURE__ */ j5((e) => new z5(e));
function G5(e, t) {
  const n = Array.from(`${e}::`).map((s) => s.charCodeAt(0)), a = new Uint8Array(n.length + t.length);
  return a.set(n), a.set(t, n.length), io(a, { dkLen: 32 });
}
function Cr(e) {
  return H(e).replace("0x", "");
}
var _t = class mt {
  static fromKindBytes(t) {
    const n = A.TransactionKind.parse(t).ProgrammableTransaction;
    if (!n) throw new Error("Unable to deserialize from bytes.");
    return mt.restore({
      version: 2,
      sender: null,
      expiration: null,
      gasData: {
        budget: null,
        owner: null,
        payment: null,
        price: null
      },
      inputs: n.inputs,
      commands: n.commands
    });
  }
  static fromBytes(t) {
    var s;
    const n = (s = A.TransactionData.parse(t)) == null ? void 0 : s.V1, a = n.kind.ProgrammableTransaction;
    if (!n || !a) throw new Error("Unable to deserialize from bytes.");
    return mt.restore({
      version: 2,
      sender: n.sender,
      expiration: n.expiration,
      gasData: n.gasData,
      inputs: a.inputs,
      commands: a.commands
    });
  }
  static restore(t) {
    return t.version === 2 ? new mt(y0(Dn, t)) : new mt(y0(Dn, x5(t)));
  }
  /**
  * Generate transaction digest.
  *
  * @param bytes BCS serialized transaction data
  * @returns transaction digest.
  */
  static getDigestFromBytes(t) {
    return Tn(G5("TransactionData", t));
  }
  constructor(t) {
    this.version = 2, this.sender = (t == null ? void 0 : t.sender) ?? null, this.expiration = (t == null ? void 0 : t.expiration) ?? null, this.inputs = (t == null ? void 0 : t.inputs) ?? [], this.commands = (t == null ? void 0 : t.commands) ?? [], this.gasData = (t == null ? void 0 : t.gasData) ?? {
      budget: null,
      price: null,
      owner: null,
      payment: null
    };
  }
  build({ maxSizeBytes: t = 1 / 0, overrides: n, onlyTransactionKind: a } = {}) {
    const s = this.inputs, r = this.commands, i = { ProgrammableTransaction: {
      inputs: s,
      commands: r
    } };
    if (a) return A.TransactionKind.serialize(i, { maxSize: t }).toBytes();
    const c = (n == null ? void 0 : n.expiration) ?? this.expiration, o = (n == null ? void 0 : n.sender) ?? this.sender, d = {
      ...this.gasData,
      ...n == null ? void 0 : n.gasData
    };
    if (!o) throw new Error("Missing transaction sender");
    if (!d.budget) throw new Error("Missing gas budget");
    if (!d.payment) throw new Error("Missing gas payment");
    if (!d.price) throw new Error("Missing gas price");
    const u = {
      sender: Cr(o),
      expiration: c || { None: !0 },
      gasData: {
        payment: d.payment,
        owner: Cr(this.gasData.owner ?? o),
        price: BigInt(d.price),
        budget: BigInt(d.budget)
      },
      kind: { ProgrammableTransaction: {
        inputs: s,
        commands: r
      } }
    };
    return A.TransactionData.serialize({ V1: u }, { maxSize: t }).toBytes();
  }
  addInput(t, n) {
    const a = this.inputs.length;
    return this.inputs.push(n), {
      Input: a,
      type: t,
      $kind: "Input"
    };
  }
  getInputUses(t, n) {
    this.mapArguments((a, s) => (a.$kind === "Input" && a.Input === t && n(a, s), a));
  }
  mapCommandArguments(t, n) {
    const a = this.commands[t];
    switch (a.$kind) {
      case "MoveCall":
        a.MoveCall.arguments = a.MoveCall.arguments.map((r) => n(r, a, t));
        break;
      case "TransferObjects":
        a.TransferObjects.objects = a.TransferObjects.objects.map((r) => n(r, a, t)), a.TransferObjects.address = n(a.TransferObjects.address, a, t);
        break;
      case "SplitCoins":
        a.SplitCoins.coin = n(a.SplitCoins.coin, a, t), a.SplitCoins.amounts = a.SplitCoins.amounts.map((r) => n(r, a, t));
        break;
      case "MergeCoins":
        a.MergeCoins.destination = n(a.MergeCoins.destination, a, t), a.MergeCoins.sources = a.MergeCoins.sources.map((r) => n(r, a, t));
        break;
      case "MakeMoveVec":
        a.MakeMoveVec.elements = a.MakeMoveVec.elements.map((r) => n(r, a, t));
        break;
      case "Upgrade":
        a.Upgrade.ticket = n(a.Upgrade.ticket, a, t);
        break;
      case "$Intent":
        const s = a.$Intent.inputs;
        a.$Intent.inputs = {};
        for (const [r, i] of Object.entries(s)) a.$Intent.inputs[r] = Array.isArray(i) ? i.map((c) => n(c, a, t)) : n(i, a, t);
        break;
      case "Publish":
        break;
      default:
        throw new Error(`Unexpected transaction kind: ${a.$kind}`);
    }
  }
  mapArguments(t) {
    for (const n of this.commands.keys()) this.mapCommandArguments(n, t);
  }
  replaceCommand(t, n, a = t) {
    if (!Array.isArray(n)) {
      this.commands[t] = n;
      return;
    }
    const s = n.length - 1;
    this.commands.splice(t, 1, ...structuredClone(n)), this.mapArguments((r, i, c) => {
      if (c < t + n.length) return r;
      if (typeof a != "number" && (r.$kind === "Result" && r.Result === t || r.$kind === "NestedResult" && r.NestedResult[0] === t)) {
        if (!("NestedResult" in r) || r.NestedResult[1] === 0) return y0(w0, structuredClone(a));
        throw new Error(`Cannot replace command ${t} with a specific result type: NestedResult[${t}, ${r.NestedResult[1]}] references a nested element that cannot be mapped to the replacement result`);
      }
      switch (r.$kind) {
        case "Result":
          r.Result === t && typeof a == "number" && (r.Result = a), r.Result > t && (r.Result += s);
          break;
        case "NestedResult":
          if (r.NestedResult[0] === t && typeof a == "number") return {
            $kind: "NestedResult",
            NestedResult: [a, r.NestedResult[1]]
          };
          r.NestedResult[0] > t && (r.NestedResult[0] += s);
          break;
      }
      return r;
    });
  }
  replaceCommandWithTransaction(t, n, a) {
    if (a.$kind !== "Result" && a.$kind !== "NestedResult") throw new Error("Result must be of kind Result or NestedResult");
    this.insertTransaction(t, n), this.replaceCommand(t + n.commands.length, [], "Result" in a ? { NestedResult: [a.Result + t, 0] } : { NestedResult: [a.NestedResult[0] + t, a.NestedResult[1]] });
  }
  insertTransaction(t, n) {
    var c, o;
    const a = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
    for (let d = 0; d < n.inputs.length; d++) {
      const u = n.inputs[d], l = Yn(u);
      let b = -1;
      if (l !== void 0 && (b = this.inputs.findIndex((p) => Yn(p) === l), b !== -1 && ((c = this.inputs[b].Object) != null && c.SharedObject) && ((o = u.Object) != null && o.SharedObject) && (this.inputs[b].Object.SharedObject.mutable = this.inputs[b].Object.SharedObject.mutable || u.Object.SharedObject.mutable)), b !== -1) a.set(d, b);
      else {
        const p = this.inputs.length;
        this.inputs.push(u), a.set(d, p);
      }
    }
    for (let d = 0; d < n.commands.length; d++) s.set(d, t + d);
    const r = [];
    for (let d = 0; d < n.commands.length; d++) {
      const u = structuredClone(n.commands[d]);
      D6(u, a, s), r.push(u);
    }
    this.commands.splice(t, 0, ...r);
    const i = r.length;
    i > 0 && this.mapArguments((d, u, l) => {
      if (l >= t && l < t + r.length) return d;
      switch (d.$kind) {
        case "Result":
          d.Result >= t && (d.Result += i);
          break;
        case "NestedResult":
          d.NestedResult[0] >= t && (d.NestedResult[0] += i);
          break;
      }
      return d;
    });
  }
  getDigest() {
    const t = this.build({ onlyTransactionKind: !1 });
    return mt.getDigestFromBytes(t);
  }
  snapshot() {
    return y0(Dn, this);
  }
  shallowClone() {
    return new mt({
      version: this.version,
      sender: this.sender,
      expiration: this.expiration,
      gasData: { ...this.gasData },
      inputs: [...this.inputs],
      commands: [...this.commands]
    });
  }
  applyResolvedData(t) {
    this.sender || (this.sender = t.sender ?? null), this.expiration || (this.expiration = t.expiration ?? null), this.gasData.budget || (this.gasData.budget = t.gasData.budget), this.gasData.owner || (this.gasData.owner = t.gasData.owner ?? null), this.gasData.payment || (this.gasData.payment = t.gasData.payment), this.gasData.price || (this.gasData.price = t.gasData.price);
    for (let n = 0; n < this.inputs.length; n++) {
      const a = this.inputs[n], s = t.inputs[n];
      switch (a.$kind) {
        case "UnresolvedPure":
          if (s.$kind !== "Pure") throw new Error(`Expected input at index ${n} to resolve to a Pure argument, but got ${JSON.stringify(s)}`);
          this.inputs[n] = s;
          break;
        case "UnresolvedObject":
          if (s.$kind !== "Object") throw new Error(`Expected input at index ${n} to resolve to an Object argument, but got ${JSON.stringify(s)}`);
          if (s.Object.$kind === "ImmOrOwnedObject" || s.Object.$kind === "Receiving") {
            const r = a.UnresolvedObject, i = s.Object.ImmOrOwnedObject ?? s.Object.Receiving;
            if (H(r.objectId) !== H(i.objectId) || r.version != null && r.version !== i.version || r.digest != null && r.digest !== i.digest || r.mutable != null || r.initialSharedVersion != null) throw new Error(`Input at index ${n} did not match unresolved object. ${JSON.stringify(r)} is not compatible with ${JSON.stringify(i)}`);
          } else if (s.Object.$kind === "SharedObject") {
            const r = a.UnresolvedObject, i = s.Object.SharedObject;
            if (H(r.objectId) !== H(i.objectId) || r.initialSharedVersion != null && r.initialSharedVersion !== i.initialSharedVersion || r.mutable != null && r.mutable !== i.mutable || r.version != null || r.digest != null) throw new Error(`Input at index ${n} did not match unresolved object. ${JSON.stringify(r)} is not compatible with ${JSON.stringify(i)}`);
          } else throw new Error(`Input at index ${n} resolved to an unexpected Object kind: ${JSON.stringify(s.Object)}`);
          this.inputs[n] = s;
          break;
      }
    }
  }
};
const R0 = {
  MoveCall(e) {
    const [t, n = "", a = ""] = "target" in e ? e.target.split("::") : [
      e.package,
      e.module,
      e.function
    ];
    return {
      $kind: "MoveCall",
      MoveCall: {
        package: t,
        module: n,
        function: a,
        typeArguments: e.typeArguments ?? [],
        arguments: e.arguments ?? []
      }
    };
  },
  TransferObjects(e, t) {
    return {
      $kind: "TransferObjects",
      TransferObjects: {
        objects: e.map((n) => y0(w0, n)),
        address: y0(w0, t)
      }
    };
  },
  SplitCoins(e, t) {
    return {
      $kind: "SplitCoins",
      SplitCoins: {
        coin: y0(w0, e),
        amounts: t.map((n) => y0(w0, n))
      }
    };
  },
  MergeCoins(e, t) {
    return {
      $kind: "MergeCoins",
      MergeCoins: {
        destination: y0(w0, e),
        sources: t.map((n) => y0(w0, n))
      }
    };
  },
  Publish({ modules: e, dependencies: t }) {
    return {
      $kind: "Publish",
      Publish: {
        modules: e.map((n) => typeof n == "string" ? n : Q0(new Uint8Array(n))),
        dependencies: t.map((n) => es(n))
      }
    };
  },
  Upgrade({ modules: e, dependencies: t, package: n, ticket: a }) {
    return {
      $kind: "Upgrade",
      Upgrade: {
        modules: e.map((s) => typeof s == "string" ? s : Q0(new Uint8Array(s))),
        dependencies: t.map((s) => es(s)),
        package: n,
        ticket: y0(w0, a)
      }
    };
  },
  MakeMoveVec({ type: e, elements: t }) {
    return {
      $kind: "MakeMoveVec",
      MakeMoveVec: {
        type: e ?? null,
        elements: t.map((n) => y0(w0, n))
      }
    };
  },
  Intent({ name: e, inputs: t = {}, data: n = {} }) {
    return {
      $kind: "$Intent",
      $Intent: {
        name: e,
        inputs: Object.fromEntries(Object.entries(t).map(([a, s]) => [a, Array.isArray(s) ? s.map((r) => y0(w0, r)) : y0(w0, s)])),
        data: n
      }
    };
  }
};
function W5(e) {
  return {
    $kind: "Pure",
    Pure: { bytes: e instanceof Uint8Array ? Q0(e) : e.toBase64() }
  };
}
const P0 = {
  Pure: W5,
  ObjectRef({ objectId: e, digest: t, version: n }) {
    return {
      $kind: "Object",
      Object: {
        $kind: "ImmOrOwnedObject",
        ImmOrOwnedObject: {
          digest: t,
          version: n,
          objectId: H(e)
        }
      }
    };
  },
  SharedObjectRef({ objectId: e, mutable: t, initialSharedVersion: n }) {
    return {
      $kind: "Object",
      Object: {
        $kind: "SharedObject",
        SharedObject: {
          mutable: t,
          initialSharedVersion: n,
          objectId: H(e)
        }
      }
    };
  },
  ReceivingRef({ objectId: e, digest: t, version: n }) {
    return {
      $kind: "Object",
      Object: {
        $kind: "Receiving",
        Receiving: {
          digest: t,
          version: n,
          objectId: H(e)
        }
      }
    };
  },
  FundsWithdrawal({ reservation: e, typeArg: t, withdrawFrom: n }) {
    return {
      $kind: "FundsWithdrawal",
      FundsWithdrawal: {
        reservation: e,
        typeArg: t,
        withdrawFrom: n
      }
    };
  }
};
BigInt(1e9);
const co = "0x0000000000000000000000000000000000000000000000000000000000000001", Us = "0x0000000000000000000000000000000000000000000000000000000000000002", Q5 = "0x0000000000000000000000000000000000000000000000000000000000000006", qn = `${Us}::sui::SUI`, xr = "0x0000000000000000000000000000000000000000000000000000000000000005", J5 = "0x0000000000000000000000000000000000000000000000000000000000000008", Y5 = "0x0000000000000000000000000000000000000000000000000000000000000403";
function oo(e) {
  const t = e.split("::");
  if (t.length !== 3) throw new Error(`Invalid type name format: ${e}`);
  return {
    package: t[0],
    module: t[1],
    name: t[2]
  };
}
function Z5(e) {
  if (e.body.$kind !== "datatype") return !1;
  const { package: t, module: n, name: a } = oo(e.body.datatype.typeName);
  return H(t) === Us && n === "tx_context" && a === "TxContext";
}
function is(e) {
  switch (e.$kind) {
    case "address":
      return A.Address;
    case "bool":
      return A.Bool;
    case "u8":
      return A.U8;
    case "u16":
      return A.U16;
    case "u32":
      return A.U32;
    case "u64":
      return A.U64;
    case "u128":
      return A.U128;
    case "u256":
      return A.U256;
    case "vector": {
      if (e.vector.$kind === "u8") return A.byteVector().transform({
        input: (n) => typeof n == "string" ? new TextEncoder().encode(n) : n,
        output: (n) => n
      });
      const t = is(e.vector);
      return t ? A.vector(t) : null;
    }
    case "datatype": {
      const { package: t, module: n, name: a } = oo(e.datatype.typeName), s = H(t);
      if (s === co) {
        if (n === "ascii" && a === "String" || n === "string" && a === "String") return A.String;
        if (n === "option" && a === "Option") {
          const r = is(e.datatype.typeParameters[0]);
          return r ? A.vector(r) : null;
        }
      }
      return s === Us && n === "object" && a === "ID" ? A.Address : null;
    }
    case "typeParameter":
    case "unknown":
      return null;
  }
}
const Ot = "CoinWithBalance", nt = ye("0x2::sui::SUI");
function H5({ type: e = nt, balance: t, useGasCoin: n = !0 }) {
  let a = null;
  return (s) => {
    if (a) return a;
    s.addIntentResolver(Ot, Ps);
    const r = e === "gas" ? e : ye(e);
    return a = s.add(R0.Intent({
      name: Ot,
      inputs: {},
      data: {
        type: r === nt && n ? "gas" : r,
        balance: BigInt(t),
        outputKind: "coin"
      }
    })), a;
  };
}
function q5({ type: e = nt, balance: t, useGasCoin: n = !0 }) {
  let a = null;
  return (s) => {
    if (a) return a;
    s.addIntentResolver(Ot, Ps);
    const r = e === "gas" ? e : ye(e);
    return a = s.add(R0.Intent({
      name: Ot,
      inputs: {},
      data: {
        type: r === nt && n ? "gas" : r,
        balance: BigInt(t),
        outputKind: "balance"
      }
    })), a;
  };
}
const _r = /* @__PURE__ */ U({
  type: /* @__PURE__ */ i0(),
  balance: /* @__PURE__ */ D0(/* @__PURE__ */ fe([
    /* @__PURE__ */ xs(),
    /* @__PURE__ */ i0(),
    /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0())
  ]), /* @__PURE__ */ pa((e) => BigInt(e))),
  outputKind: /* @__PURE__ */ K0(/* @__PURE__ */ yc(["coin", "balance"]))
});
async function Ps(e, t, n) {
  var m, h;
  const a = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
  if (!e.sender) throw new Error("Sender must be set to resolve CoinWithBalance");
  for (const [y, w] of e.commands.entries()) {
    if (w.$kind !== "$Intent" || w.$Intent.name !== Ot) continue;
    const { type: I, balance: C, outputKind: R } = y0(_r, w.$Intent.data);
    if (C === 0n) {
      const F = I === "gas" ? nt : I;
      e.replaceCommand(y, R0.MoveCall({
        target: (R ?? "coin") === "balance" ? "0x2::balance::zero" : "0x2::coin::zero",
        typeArguments: [F]
      }));
      continue;
    }
    I !== "gas" && a.add(I), s.set(I, (s.get(I) ?? 0n) + C), r.has(I) || r.set(I, []), r.get(I).push({
      balance: C,
      outputKind: R ?? "coin"
    });
  }
  if (s.has("gas") && s.has(nt)) throw new Error("Cannot mix SUI CoinWithBalance intents that use the gas coin with ones that do not (useGasCoin: false). Use one or the other.");
  const i = /* @__PURE__ */ new Set();
  for (const y of e.inputs)
    (m = y.Object) != null && m.ImmOrOwnedObject && i.add(y.Object.ImmOrOwnedObject.objectId), (h = y.UnresolvedObject) != null && h.objectId && i.add(y.UnresolvedObject.objectId);
  const c = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), d = t.client;
  if (!d) throw new Error("Client must be provided to build or serialize transactions with CoinWithBalance intents");
  await Promise.all([...[...a].map(async (y) => {
    const { coins: w, addressBalance: I } = await X5({
      coinType: y,
      balance: s.get(y),
      client: d,
      owner: e.sender,
      usedIds: i
    });
    c.set(y, w), o.set(y, I);
  }), s.has("gas") ? await d.core.getBalance({
    owner: e.sender,
    coinType: nt
  }).then(({ balance: y }) => {
    o.set("gas", BigInt(y.addressBalance));
  }) : null]);
  const u = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), b = /* @__PURE__ */ new Map();
  let p = 0;
  for (; p < e.commands.length; ) {
    const y = e.commands[p];
    if (y.$kind !== "$Intent" || y.$Intent.name !== Ot) {
      p++;
      continue;
    }
    const { type: w, balance: I } = y0(_r, y.$Intent.data), C = w === "gas" ? nt : w, R = s.get(w), F = o.get(w) ?? 0n, j = [];
    let D;
    const P = r.get(w) ?? [];
    if (P.every((O) => O.outputKind === "balance") && F >= R)
      j.push(R0.MoveCall({
        target: "0x2::balance::redeem_funds",
        typeArguments: [C],
        arguments: [e.addInput("withdrawal", P0.FundsWithdrawal({
          reservation: {
            $kind: "MaxAmountU64",
            MaxAmountU64: String(I)
          },
          typeArg: {
            $kind: "Balance",
            Balance: C
          },
          withdrawFrom: {
            $kind: "Sender",
            Sender: !0
          }
        }))]
      })), D = {
        $kind: "NestedResult",
        NestedResult: [p + j.length - 1, 0]
      };
    else {
      if (!b.has(w)) {
        const Q = P, $ = [];
        if (F >= R)
          l.add(w), j.push(R0.MoveCall({
            target: "0x2::coin::redeem_funds",
            typeArguments: [C],
            arguments: [e.addInput("withdrawal", P0.FundsWithdrawal({
              reservation: {
                $kind: "MaxAmountU64",
                MaxAmountU64: String(R)
              },
              typeArg: {
                $kind: "Balance",
                Balance: C
              },
              withdrawFrom: {
                $kind: "Sender",
                Sender: !0
              }
            }))]
          })), $.push({
            $kind: "Result",
            Result: p + j.length - 1
          });
        else if (w === "gas") $.push({
          $kind: "GasCoin",
          GasCoin: !0
        });
        else {
          const G = c.get(w), E = G.reduce((J, On) => J + BigInt(On.balance), 0n), p0 = R > E ? R - E : 0n;
          u.set(w, E + p0 === R);
          for (const J of G) $.push(e.addInput("object", P0.ObjectRef({
            objectId: J.objectId,
            digest: J.digest,
            version: J.version
          })));
          p0 > 0n && (l.add(w), j.push(R0.MoveCall({
            target: "0x2::coin::redeem_funds",
            typeArguments: [C],
            arguments: [e.addInput("withdrawal", P0.FundsWithdrawal({
              reservation: {
                $kind: "MaxAmountU64",
                MaxAmountU64: String(p0)
              },
              typeArg: {
                $kind: "Balance",
                Balance: C
              },
              withdrawFrom: {
                $kind: "Sender",
                Sender: !0
              }
            }))]
          })), $.push({
            $kind: "Result",
            Result: p + j.length - 1
          }));
        }
        const v = $[0], q = $.slice(1);
        for (let G = 0; G < q.length; G += 500) j.push(R0.MergeCoins(v, q.slice(G, G + 500)));
        const b0 = p + j.length;
        j.push(R0.SplitCoins(v, Q.map((G) => e.addInput("pure", P0.Pure(A.u64().serialize(G.balance))))));
        const x = [];
        for (let G = 0; G < Q.length; G++) {
          const E = {
            $kind: "NestedResult",
            NestedResult: [b0, G]
          };
          Q[G].outputKind === "balance" ? (j.push(R0.MoveCall({
            target: "0x2::coin::into_balance",
            typeArguments: [C],
            arguments: [E]
          })), x.push({
            $kind: "NestedResult",
            NestedResult: [p + j.length - 1, 0]
          })) : x.push(E);
        }
        if (w !== "gas" || l.has(w)) {
          const G = Q.some((p0) => p0.outputKind === "balance"), E = l.has(w);
          G || E ? j.push(R0.MoveCall({
            target: "0x2::coin::send_funds",
            typeArguments: [C],
            arguments: [v, e.addInput("pure", P0.Pure(A.Address.serialize(e.sender)))]
          })) : u.get(w) && j.push(R0.MoveCall({
            target: "0x2::coin::destroy_zero",
            typeArguments: [C],
            arguments: [v]
          }));
        }
        b.set(w, {
          results: x,
          nextIntent: 0
        });
      }
      const O = b.get(w);
      D = O.results[O.nextIntent++];
    }
    e.replaceCommand(p, j, D), p += j.length;
  }
  return n();
}
async function X5({ coinType: e, balance: t, client: n, owner: a, usedIds: s }) {
  let r = t;
  const i = [], c = n.core.getBalance({
    owner: a,
    coinType: e
  }).then(({ balance: l }) => (r -= BigInt(l.addressBalance), l)), [o, d] = await Promise.all([u(), c]);
  if (BigInt(d.balance) < t) throw new Error(`Insufficient balance of ${e} for owner ${a}. Required: ${t}, Available: ${t - r}`);
  return {
    coins: o,
    balance: BigInt(d.coinBalance),
    addressBalance: BigInt(d.addressBalance),
    coinBalance: BigInt(d.coinBalance)
  };
  async function u(l = null) {
    const { objects: b, hasNextPage: p, cursor: m } = await n.core.listCoins({
      owner: a,
      coinType: e,
      cursor: l
    });
    await c;
    for (const h of b)
      s.has(h.objectId) || (i.push(h), r -= BigInt(h.balance));
    return r > 0n && p ? u(m) : i;
  }
}
function fn(e) {
  return /* @__PURE__ */ fe(Object.entries(e).map(([t, n]) => /* @__PURE__ */ U({ [t]: n })));
}
const be = fn({
  GasCoin: /* @__PURE__ */ d0(!0),
  Input: /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0()),
  Result: /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0()),
  NestedResult: /* @__PURE__ */ _s([/* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0()), /* @__PURE__ */ D0(/* @__PURE__ */ W0(), /* @__PURE__ */ G0())])
}), K5 = /* @__PURE__ */ U({
  budget: /* @__PURE__ */ h0(M0),
  price: /* @__PURE__ */ h0(M0),
  owner: /* @__PURE__ */ h0(zt),
  payment: /* @__PURE__ */ h0(/* @__PURE__ */ n0(dt))
}), eu = /* @__PURE__ */ U({
  package: se,
  module: /* @__PURE__ */ i0(),
  function: /* @__PURE__ */ i0(),
  typeArguments: /* @__PURE__ */ n0(/* @__PURE__ */ i0()),
  arguments: /* @__PURE__ */ n0(be)
}), tu = /* @__PURE__ */ U({
  name: /* @__PURE__ */ i0(),
  inputs: /* @__PURE__ */ dn(/* @__PURE__ */ i0(), /* @__PURE__ */ fe([be, /* @__PURE__ */ n0(be)])),
  data: /* @__PURE__ */ dn(/* @__PURE__ */ i0(), /* @__PURE__ */ vn())
}), nu = fn({
  MoveCall: eu,
  TransferObjects: /* @__PURE__ */ U({
    objects: /* @__PURE__ */ n0(be),
    address: be
  }),
  SplitCoins: /* @__PURE__ */ U({
    coin: be,
    amounts: /* @__PURE__ */ n0(be)
  }),
  MergeCoins: /* @__PURE__ */ U({
    destination: be,
    sources: /* @__PURE__ */ n0(be)
  }),
  Publish: /* @__PURE__ */ U({
    modules: /* @__PURE__ */ n0(It),
    dependencies: /* @__PURE__ */ n0(se)
  }),
  MakeMoveVec: /* @__PURE__ */ U({
    type: /* @__PURE__ */ h0(/* @__PURE__ */ i0()),
    elements: /* @__PURE__ */ n0(be)
  }),
  Upgrade: /* @__PURE__ */ U({
    modules: /* @__PURE__ */ n0(It),
    dependencies: /* @__PURE__ */ n0(se),
    package: se,
    ticket: be
  }),
  $Intent: tu
}), au = fn({
  Object: fn({
    ImmOrOwnedObject: dt,
    SharedObject: /* @__PURE__ */ U({
      objectId: se,
      initialSharedVersion: M0,
      mutable: /* @__PURE__ */ Vt()
    }),
    Receiving: dt
  }),
  Pure: /* @__PURE__ */ U({ bytes: It }),
  UnresolvedPure: /* @__PURE__ */ U({ value: /* @__PURE__ */ vn() }),
  UnresolvedObject: /* @__PURE__ */ U({
    objectId: se,
    version: /* @__PURE__ */ K0(/* @__PURE__ */ h0(M0)),
    digest: /* @__PURE__ */ K0(/* @__PURE__ */ h0(/* @__PURE__ */ i0())),
    initialSharedVersion: /* @__PURE__ */ K0(/* @__PURE__ */ h0(M0)),
    mutable: /* @__PURE__ */ K0(/* @__PURE__ */ h0(/* @__PURE__ */ Vt()))
  }),
  FundsWithdrawal: Tc
}), su = fn({
  None: /* @__PURE__ */ d0(!0),
  Epoch: M0,
  ValidDuring: vc
}), ru = /* @__PURE__ */ U({
  version: /* @__PURE__ */ d0(2),
  sender: /* @__PURE__ */ on(zt),
  expiration: /* @__PURE__ */ on(su),
  gasData: K5,
  inputs: /* @__PURE__ */ n0(au),
  commands: /* @__PURE__ */ n0(nu),
  digest: /* @__PURE__ */ K0(/* @__PURE__ */ h0(/* @__PURE__ */ i0()))
});
var Vs = class extends Error {
}, fo = class extends Vs {
  constructor(e, t) {
    super(e, { cause: t == null ? void 0 : t.cause }), this.executionError = t == null ? void 0 : t.executionError;
  }
}, Br = class extends Vs {
  constructor(e, t, n) {
    super(t, { cause: n == null ? void 0 : n.cause }), this.code = e, this.reason = (n == null ? void 0 : n.reason) ?? "unknown", this.objectId = n == null ? void 0 : n.objectId;
  }
};
const iu = { notFound: (e) => `Transaction ${e} not found` };
var cu = class extends Vs {
  constructor(e, t, n) {
    super(iu[e](t), n), this.reason = e, this.digest = t;
  }
};
function In(e, t, n) {
  const a = A.Address.serialize(e).toBytes(), s = A.TypeTag.serialize(t).toBytes(), r = A.u64().serialize(n.length).toBytes(), i = io.create({ dkLen: 32 });
  return i.update(new Uint8Array([240])), i.update(a), i.update(r), i.update(n), i.update(s), `0x${Qe(i.digest().slice(0, 32))}`;
}
const ou = H("0xacc"), du = Ft.parseFromStr("0x2::accumulator::Key<0x2::balance::Balance<0x2::sui::SUI>>"), fu = new Uint8Array([
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172,
  172
]);
function uu(e, t) {
  const n = Ns(In(ou, du, A.Address.serialize(e).toBytes()).slice(2)), a = rn(t);
  if (a.length !== 32) throw new Error(`Invalid chain identifier length: expected 32 bytes, got ${a.length}`);
  const s = new Uint8Array(32);
  for (let r = 0; r < 32; r++) s[r] = n[r] ^ a[r];
  return `0x${Qe(s)}`;
}
function lu(e, t, n, a) {
  const s = new Uint8Array(32), r = new DataView(s.buffer);
  r.setBigUint64(0, e, !0);
  const i = Number(a);
  if (!Number.isSafeInteger(i) || i < 0 || i > 4294967295) throw new Error(`Epoch ${a} out of u32 range for coin reservation digest`);
  return r.setUint32(8, i, !0), s.set(fu, 12), y0(dt, {
    objectId: uu(t, n),
    version: "0",
    digest: Tn(s)
  });
}
function z0(e) {
  return Uint8Array.from(atob(e), (t) => t.charCodeAt(0));
}
const Ma = 8192;
function cs(e) {
  if (e.length < Ma) return btoa(String.fromCharCode(...e));
  let t = "";
  for (var n = 0; n < e.length; n += Ma) {
    const a = e.slice(n, n + Ma);
    t += String.fromCharCode(...a);
  }
  return btoa(t);
}
function Xn(e, t) {
  return Array.from({ length: Math.ceil(e.length / t) }, (n, a) => e.slice(a * t, (a + 1) * t));
}
var jr = class {
  constructor(e, t) {
    if (typeof e != "function") throw new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but got: ${e}.`);
    this._batchLoadFn = e, this._maxBatchSize = gu(t), this._batchScheduleFn = hu(t), this._cacheKeyFn = Au(t), this._cacheMap = yu(t), this._batch = null, this.name = wu(t);
  }
  /**
  * Loads a key, returning a `Promise` for the value represented by that key.
  */
  load(e) {
    if (e == null) throw new TypeError(`The loader.load() function must be called with a value, but got: ${String(e)}.`);
    const t = pu(this), n = this._cacheMap;
    let a;
    if (n) {
      a = this._cacheKeyFn(e);
      const r = n.get(a);
      if (r) {
        const i = t.cacheHits || (t.cacheHits = []);
        return new Promise((c) => {
          i.push(() => {
            c(r);
          });
        });
      }
    }
    t.keys.push(e);
    const s = new Promise((r, i) => {
      t.callbacks.push({
        resolve: r,
        reject: i
      });
    });
    return n && n.set(a, s), s;
  }
  /**
  * Loads multiple keys, promising an array of values:
  *
  *     var [ a, b ] = await myLoader.loadMany([ 'a', 'b' ]);
  *
  * This is similar to the more verbose:
  *
  *     var [ a, b ] = await Promise.all([
  *       myLoader.load('a'),
  *       myLoader.load('b')
  *     ]);
  *
  * However it is different in the case where any load fails. Where
  * Promise.all() would reject, loadMany() always resolves, however each result
  * is either a value or an Error instance.
  *
  *     var [ a, b, c ] = await myLoader.loadMany([ 'a', 'b', 'badkey' ]);
  *     // c instanceof Error
  *
  */
  loadMany(e) {
    if (!uo(e)) throw new TypeError(`The loader.loadMany() function must be called with Array<key>, but got: ${e}.`);
    const t = [];
    for (let n = 0; n < e.length; n++) t.push(this.load(e[n]).catch((a) => a));
    return Promise.all(t);
  }
  /**
  * Clears the value at `key` from the cache, if it exists. Returns itself for
  * method chaining.
  */
  clear(e) {
    const t = this._cacheMap;
    if (t) {
      const n = this._cacheKeyFn(e);
      t.delete(n);
    }
    return this;
  }
  /**
  * Clears the entire cache. To be used when some event results in unknown
  * invalidations across this particular `DataLoader`. Returns itself for
  * method chaining.
  */
  clearAll() {
    const e = this._cacheMap;
    return e && e.clear(), this;
  }
  /**
  * Adds the provided key and value to the cache. If the key already
  * exists, no change is made. Returns itself for method chaining.
  *
  * To prime the cache with an error at a key, provide an Error instance.
  */
  prime(e, t) {
    const n = this._cacheMap;
    if (n) {
      const a = this._cacheKeyFn(e);
      if (n.get(a) === void 0) {
        let s;
        t instanceof Error ? (s = Promise.reject(t), s.catch(() => {
        })) : s = Promise.resolve(t), n.set(a, s);
      }
    }
    return this;
  }
};
const bu = typeof process == "object" && typeof process.nextTick == "function" ? function(e) {
  Ra || (Ra = Promise.resolve()), Ra.then(() => {
    process.nextTick(e);
  });
} : typeof setImmediate == "function" ? function(e) {
  setImmediate(e);
} : function(e) {
  setTimeout(e);
};
let Ra;
function pu(e) {
  const t = e._batch;
  if (t !== null && !t.hasDispatched && t.keys.length < e._maxBatchSize) return t;
  const n = {
    hasDispatched: !1,
    keys: [],
    callbacks: []
  };
  return e._batch = n, e._batchScheduleFn(() => {
    mu(e, n);
  }), n;
}
function mu(e, t) {
  if (t.hasDispatched = !0, t.keys.length === 0) {
    os(t);
    return;
  }
  let n;
  try {
    n = e._batchLoadFn(t.keys);
  } catch (a) {
    return Da(e, t, /* @__PURE__ */ new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function errored synchronously: ${String(a)}.`));
  }
  if (!n || typeof n.then != "function") return Da(e, t, /* @__PURE__ */ new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function did not return a Promise: ${String(n)}.`));
  Promise.resolve(n).then((a) => {
    if (!uo(a)) throw new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function did not return a Promise of an Array: ${String(a)}.`);
    if (a.length !== t.keys.length) throw new TypeError(`DataLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>, but the function did not return a Promise of an Array of the same length as the Array of keys.

Keys:
${String(t.keys)}

Values:
${String(a)}`);
    os(t);
    for (let s = 0; s < t.callbacks.length; s++) {
      const r = a[s];
      r instanceof Error ? t.callbacks[s].reject(r) : t.callbacks[s].resolve(r);
    }
  }).catch((a) => {
    Da(e, t, a);
  });
}
function Da(e, t, n) {
  os(t);
  for (let a = 0; a < t.keys.length; a++)
    e.clear(t.keys[a]), t.callbacks[a].reject(n);
}
function os(e) {
  if (e.cacheHits) for (let t = 0; t < e.cacheHits.length; t++) e.cacheHits[t]();
}
function gu(e) {
  if (!(!e || e.batch !== !1)) return 1;
  const t = e && e.maxBatchSize;
  if (t === void 0) return 1 / 0;
  if (typeof t != "number" || t < 1) throw new TypeError(`maxBatchSize must be a positive number: ${t}`);
  return t;
}
function hu(e) {
  const t = e && e.batchScheduleFn;
  if (t === void 0) return bu;
  if (typeof t != "function") throw new TypeError(`batchScheduleFn must be a function: ${t}`);
  return t;
}
function Au(e) {
  const t = e && e.cacheKeyFn;
  if (t === void 0) return (n) => n;
  if (typeof t != "function") throw new TypeError(`cacheKeyFn must be a function: ${t}`);
  return t;
}
function yu(e) {
  if (!(!e || e.cache !== !1)) return null;
  const t = e && e.cacheMap;
  if (t === void 0) return /* @__PURE__ */ new Map();
  if (t !== null) {
    const n = [
      "get",
      "set",
      "delete",
      "clear"
    ].filter((a) => t && typeof t[a] != "function");
    if (n.length !== 0) throw new TypeError("Custom cacheMap missing methods: " + n.join(", "));
  }
  return t;
}
function wu(e) {
  return e && e.name ? e.name : null;
}
function uo(e) {
  return typeof e == "object" && e !== null && "length" in e && typeof e.length == "number" && (e.length === 0 || e.length > 0 && Object.prototype.hasOwnProperty.call(e, e.length - 1));
}
const Tu = 50, vu = 1000n, Iu = 5e10;
function Ou(e, t = 1n) {
  const n = vu * BigInt(t), a = BigInt(e.computationCost) + n, s = a + BigInt(e.storageCost) - BigInt(e.storageRebate);
  return String(s > a ? s : a);
}
function Eu(e) {
  if (!e.client) throw new Error("No sui client passed to Transaction#build, but transaction data was not sufficient to build offline.");
  return e.client;
}
async function Su(e, t, n) {
  var w;
  const a = Eu(t), s = !t.onlyTransactionKind && !e.gasData.price, r = !t.onlyTransactionKind && !e.gasData.payment, i = e.gasData.owner ?? e.sender;
  let c = !1, o = 0n;
  e.mapArguments((I) => (I.$kind === "GasCoin" && (c = !0), I));
  const d = i ? H(i) : null;
  for (const I of e.inputs) {
    if (I.$kind !== "FundsWithdrawal" || !d || ye(I.FundsWithdrawal.typeArg.Balance) !== qn) continue;
    const C = I.FundsWithdrawal.withdrawFrom.Sender ? e.sender : i;
    C && H(C) === d && I.FundsWithdrawal.reservation.$kind === "MaxAmountU64" && (o += BigInt(I.FundsWithdrawal.reservation.MaxAmountU64));
  }
  const u = !t.onlyTransactionKind && !e.expiration && !e.gasData.budget, l = s || r && c || u, b = r && c || u, [, p, m, h, y] = await Promise.all([
    _u(e, a),
    l ? a.core.getCurrentSystemState() : null,
    r && i ? a.core.getBalance({ owner: i }) : null,
    r && i ? a.core.listCoins({
      owner: i,
      coinType: qn
    }) : null,
    b ? a.core.getChainIdentifier() : null
  ]);
  if (await xu(e, a), !t.onlyTransactionKind) {
    const I = (p == null ? void 0 : p.systemState) ?? null, C = (y == null ? void 0 : y.chainIdentifier) ?? null;
    if (I && !e.gasData.price && (e.gasData.price = I.referenceGasPrice), await ku(e, a, u && I && C ? lo(I, C) : void 0), r) {
      if (!m || !h) throw new Error("Could not resolve gas payment: a gas owner or sender must be set to fetch balance and coins.");
      Nu({
        transactionData: e,
        balance: m,
        coins: h,
        usesGasCoin: c,
        withdrawals: o,
        gasPayer: i,
        chainIdentifier: C,
        epoch: (I == null ? void 0 : I.epoch) ?? null
      });
    }
    !e.expiration && ((w = e.gasData.payment) == null ? void 0 : w.length) === 0 && await Cu(e, a, I, C);
  }
  return await n();
}
async function ku(e, t, n) {
  if (e.gasData.budget) return;
  const a = await t.core.simulateTransaction({
    transaction: e.build({ overrides: {
      gasData: {
        budget: String(Iu),
        payment: []
      },
      ...n && { expiration: n }
    } }),
    include: { effects: !0 },
    doGasSelection: !1
  });
  if (a.$kind === "FailedTransaction") {
    const s = a.FailedTransaction.status.error ?? void 0;
    throw new fo(`Transaction resolution failed: ${(s == null ? void 0 : s.message) ?? "Unknown error"}`, {
      cause: a,
      executionError: s
    });
  }
  e.gasData.budget = Ou(a.Transaction.effects.gasUsed, e.gasData.price ? String(e.gasData.price) : void 0);
}
function Nu({ transactionData: e, balance: t, coins: n, usesGasCoin: a, withdrawals: s, gasPayer: r, chainIdentifier: i, epoch: c }) {
  const o = BigInt(e.gasData.budget), d = BigInt(t.balance.addressBalance);
  if (o === 0n || !a && d >= o + s) {
    e.gasData.payment = [];
    return;
  }
  const u = n.objects.filter((p) => !e.inputs.find((m) => {
    var h;
    return (h = m.Object) != null && h.ImmOrOwnedObject ? p.objectId === m.Object.ImmOrOwnedObject.objectId : !1;
  })), l = u.map((p) => ({
    objectId: p.objectId,
    digest: p.digest,
    version: p.version
  })), b = d - s;
  if (a && b > 0n && i && c) e.gasData.payment = [lu(b, r, i, c), ...l];
  else if (u.length) e.gasData.payment = l;
  else throw new Error("No valid gas coins found for the transaction.");
}
async function Cu(e, t, n, a = null) {
  const [s, r] = await Promise.all([a ?? t.core.getChainIdentifier().then((i) => i.chainIdentifier), n ?? t.core.getCurrentSystemState().then((i) => i.systemState)]);
  e.expiration = lo(r, s);
}
function lo(e, t) {
  const n = BigInt(e.epoch);
  return {
    $kind: "ValidDuring",
    ValidDuring: {
      minEpoch: String(n),
      maxEpoch: String(n + 1n),
      minTimestamp: null,
      maxTimestamp: null,
      chain: t,
      nonce: Math.random() * 4294967296 >>> 0
    }
  };
}
async function xu(e, t) {
  const n = e.inputs.filter((u) => {
    var l;
    return u.UnresolvedObject && !(u.UnresolvedObject.version || (l = u.UnresolvedObject) != null && l.initialSharedVersion);
  }), a = [...new Set(n.map((u) => es(u.UnresolvedObject.objectId)))], s = a.length ? Xn(a, Tu) : [], r = (await Promise.all(s.map((u) => t.core.getObjects({ objectIds: u })))).flatMap((u) => u.objects), i = new Map(a.map((u, l) => [u, r[l]])), c = Array.from(i).filter(([u, l]) => l instanceof Error).map(([u, l]) => l.message);
  if (c.length) throw new Error(`The following input objects are invalid: ${c.join(", ")}`);
  const o = r.map((u) => {
    if (u instanceof Error) throw new Error(`Failed to fetch object: ${u.message}`);
    const l = u.owner, b = l && typeof l == "object" ? l.$kind === "Shared" ? l.Shared.initialSharedVersion : l.$kind === "ConsensusAddressOwner" ? l.ConsensusAddressOwner.startVersion : null : null;
    return {
      objectId: u.objectId,
      digest: u.digest,
      version: u.version,
      initialSharedVersion: b
    };
  }), d = new Map(a.map((u, l) => [u, o[l]]));
  for (const [u, l] of e.inputs.entries()) {
    if (!l.UnresolvedObject) continue;
    let b;
    const p = H(l.UnresolvedObject.objectId), m = d.get(p);
    l.UnresolvedObject.initialSharedVersion ?? (m == null ? void 0 : m.initialSharedVersion) ? b = P0.SharedObjectRef({
      objectId: p,
      initialSharedVersion: l.UnresolvedObject.initialSharedVersion || (m == null ? void 0 : m.initialSharedVersion),
      mutable: l.UnresolvedObject.mutable || Bu(e, u)
    }) : ju(e, u) && (b = P0.ReceivingRef({
      objectId: p,
      digest: l.UnresolvedObject.digest ?? (m == null ? void 0 : m.digest),
      version: l.UnresolvedObject.version ?? (m == null ? void 0 : m.version)
    })), e.inputs[e.inputs.indexOf(l)] = b ?? P0.ObjectRef({
      objectId: p,
      digest: l.UnresolvedObject.digest ?? (m == null ? void 0 : m.digest),
      version: l.UnresolvedObject.version ?? (m == null ? void 0 : m.version)
    });
  }
}
async function _u(e, t) {
  const { inputs: n, commands: a } = e, s = [], r = /* @__PURE__ */ new Set();
  a.forEach((c) => {
    if (c.MoveCall) {
      if (c.MoveCall._argumentTypes) return;
      if (c.MoveCall.arguments.map((o) => o.$kind === "Input" ? e.inputs[o.Input] : null).some((o) => (o == null ? void 0 : o.UnresolvedPure) || (o == null ? void 0 : o.UnresolvedObject) && typeof (o == null ? void 0 : o.UnresolvedObject.mutable) != "boolean")) {
        const o = `${c.MoveCall.package}::${c.MoveCall.module}::${c.MoveCall.function}`;
        r.add(o), s.push(c.MoveCall);
      }
    }
  });
  const i = /* @__PURE__ */ new Map();
  r.size > 0 && await Promise.all([...r].map(async (c) => {
    const [o, d, u] = c.split("::"), { function: l } = await t.core.getMoveFunction({
      packageId: o,
      moduleName: d,
      name: u
    });
    i.set(c, l.parameters);
  })), s.length && await Promise.all(s.map(async (c) => {
    const o = i.get(`${c.package}::${c.module}::${c.function}`);
    o && (c._argumentTypes = o.length > 0 && Z5(o.at(-1)) ? o.slice(0, o.length - 1) : o);
  })), a.forEach((c) => {
    if (!c.MoveCall) return;
    const o = c.MoveCall, d = `${o.package}::${o.module}::${o.function}`, u = o._argumentTypes;
    if (u) {
      if (u.length !== c.MoveCall.arguments.length) throw new Error(`Incorrect number of arguments for ${d}`);
      u.forEach((l, b) => {
        var I, C;
        const p = o.arguments[b];
        if (p.$kind !== "Input") return;
        const m = n[p.Input];
        if (!m.UnresolvedPure && !m.UnresolvedObject) return;
        const h = ((I = m.UnresolvedPure) == null ? void 0 : I.value) ?? ((C = m.UnresolvedObject) == null ? void 0 : C.objectId), y = is(l.body);
        if (y) {
          p.type = "pure", n[n.indexOf(m)] = P0.Pure(y.serialize(h));
          return;
        }
        if (typeof h != "string") throw new Error(`Expect the argument to be an object id string, got ${JSON.stringify(h, null, 2)}`);
        p.type = "object";
        const w = m.UnresolvedPure ? {
          $kind: "UnresolvedObject",
          UnresolvedObject: { objectId: h }
        } : m;
        n[p.Input] = w;
      });
    }
  });
}
function Bu(e, t) {
  let n = !1;
  return e.getInputUses(t, (a, s) => {
    if (s.MoveCall && s.MoveCall._argumentTypes) {
      const r = s.MoveCall.arguments.indexOf(a);
      n = s.MoveCall._argumentTypes[r].reference !== "immutable" || n;
    }
    (s.$kind === "MakeMoveVec" || s.$kind === "MergeCoins" || s.$kind === "SplitCoins" || s.$kind === "TransferObjects") && (n = !0);
  }), n;
}
function ju(e, t) {
  let n = !1;
  return e.getInputUses(t, (a, s) => {
    if (s.MoveCall && s.MoveCall._argumentTypes) {
      const r = s.MoveCall.arguments.indexOf(a);
      n = Ru(s.MoveCall._argumentTypes[r]) || n;
    }
  }), n;
}
const Mu = "0x0000000000000000000000000000000000000000000000000000000000000002::transfer::Receiving";
function Ru(e) {
  return e.body.$kind !== "datatype" ? !1 : e.body.datatype.typeName === Mu;
}
function bo(e, t) {
  return !!(e.inputs.some((n) => n.UnresolvedObject || n.UnresolvedPure) || !t.onlyTransactionKind && (!e.gasData.price || !e.gasData.budget || !e.gasData.payment || e.gasData.payment.length === 0 && !e.expiration));
}
async function Du(e, t, n) {
  var a;
  return Pu(e), bo(e, t) ? (((a = Uu(t).core) == null ? void 0 : a.resolveTransactionPlugin()) ?? Su)(e, t, async () => {
    await Mr(e), await n();
  }) : (await Mr(e), n());
}
function Mr(e) {
  e.inputs.forEach((t, n) => {
    if (t.$kind !== "Object" && t.$kind !== "Pure" && t.$kind !== "FundsWithdrawal") throw new Error(`Input at index ${n} has not been resolved.  Expected a Pure, Object, or FundsWithdrawal input, but found ${JSON.stringify(t)}`);
  });
}
function Uu(e) {
  if (!e.client) throw new Error("No sui client passed to Transaction#build, but transaction data was not sufficient to build offline.");
  return e.client;
}
function Pu(e) {
  for (const t of e.commands) switch (t.$kind) {
    case "SplitCoins":
      t.SplitCoins.amounts.forEach((n) => {
        Rr(n, A.U64, e);
      });
      break;
    case "TransferObjects":
      Rr(t.TransferObjects.address, A.Address, e);
      break;
  }
}
function Rr(e, t, n) {
  if (e.$kind !== "Input") return;
  const a = n.inputs[e.Input];
  a.$kind === "UnresolvedPure" && (n.inputs[e.Input] = P0.Pure(t.serialize(a.UnresolvedPure.value)));
}
function Vu(e) {
  function t(n) {
    return e(n);
  }
  return t.system = (n) => {
    const a = n == null ? void 0 : n.mutable;
    return t(a !== void 0 ? P0.SharedObjectRef({
      objectId: xr,
      initialSharedVersion: 1,
      mutable: a
    }) : {
      $kind: "UnresolvedObject",
      UnresolvedObject: {
        objectId: xr,
        initialSharedVersion: 1
      }
    });
  }, t.clock = () => t(P0.SharedObjectRef({
    objectId: Q5,
    initialSharedVersion: 1,
    mutable: !1
  })), t.random = () => t({
    $kind: "UnresolvedObject",
    UnresolvedObject: {
      objectId: J5,
      mutable: !1
    }
  }), t.denyList = (n) => t({
    $kind: "UnresolvedObject",
    UnresolvedObject: {
      objectId: Y5,
      mutable: n == null ? void 0 : n.mutable
    }
  }), t.option = ({ type: n, value: a }) => (s) => s.moveCall({
    typeArguments: [n],
    target: `${co}::option::${a === null ? "none" : "some"}`,
    arguments: a === null ? [] : [s.object(a)]
  }), t;
}
function Fu(e) {
  function t(n, a) {
    if (typeof n == "string") return e(qt(n).serialize(a));
    if (n instanceof Uint8Array || Ka(n)) return e(n);
    throw new Error("tx.pure must be called either a bcs type name, or a serialized bcs value");
  }
  return t.u8 = (n) => e(A.U8.serialize(n)), t.u16 = (n) => e(A.U16.serialize(n)), t.u32 = (n) => e(A.U32.serialize(n)), t.u64 = (n) => e(A.U64.serialize(n)), t.u128 = (n) => e(A.U128.serialize(n)), t.u256 = (n) => e(A.U256.serialize(n)), t.bool = (n) => e(A.Bool.serialize(n)), t.string = (n) => e(A.String.serialize(n)), t.address = (n) => e(A.Address.serialize(n)), t.id = t.address, t.vector = (n, a) => e(A.vector(qt(n)).serialize(a)), t.option = (n, a) => e(A.option(qt(n)).serialize(a)), t;
}
const $u = "2.26.1", Lu = "/", zu = { "Mvr-Source": `@mysten/sui@${$u}` };
var Dt, ve, Ut, Fe, Y0, ds, fs, po, mo, us, hi, Gu = (hi = class {
  constructor({ cache: e, url: t, pageSize: n = 50, overrides: a }) {
    o0(this, Y0);
    o0(this, Dt);
    o0(this, ve);
    o0(this, Ut);
    o0(this, Fe);
    W(this, Dt, e), W(this, ve, t), W(this, Ut, n), W(this, Fe, {
      packages: a == null ? void 0 : a.packages,
      types: a == null ? void 0 : a.types
    }), Wu(g(this, Fe));
  }
  async resolvePackage({ package: e, signal: t }) {
    return t == null || t.throwIfAborted(), Se(e) ? { package: await Un(g(this, Y0, ds).load(e), t) } : { package: e };
  }
  async resolveType({ type: e, signal: t }) {
    if (t == null || t.throwIfAborted(), !Se(e)) return { type: e };
    const n = [...Kn(e)], a = await Un(g(this, Y0, fs).loadMany(n), t), s = {};
    for (let r = 0; r < n.length; r++) {
      const i = a[r];
      if (i instanceof Error) throw i;
      s[n[r]] = i;
    }
    return { type: ea(e, s) };
  }
  async resolve({ types: e = [], packages: t = [], signal: n }) {
    var u, l, b;
    n == null || n.throwIfAborted();
    const a = /* @__PURE__ */ new Set();
    for (const p of e ?? []) Kn(p, a);
    const s = [...a], [r, i] = await Un(Promise.all([s.length > 0 ? g(this, Y0, fs).loadMany(s) : [], t.length > 0 ? g(this, Y0, ds).loadMany(t) : []]), n), c = { ...(u = g(this, Fe)) == null ? void 0 : u.types };
    for (const [p, m] of s.entries()) {
      const h = r[p];
      if (h instanceof Error) throw h;
      c[m] = h;
    }
    const o = {};
    for (const p of e ?? []) o[p] = { type: ea(p, c) };
    const d = {};
    for (const [p, m] of (t ?? []).entries()) {
      const h = ((b = (l = g(this, Fe)) == null ? void 0 : l.packages) == null ? void 0 : b[m]) ?? i[p];
      if (h instanceof Error) throw h;
      d[m] = { package: h };
    }
    return {
      types: o,
      packages: d
    };
  }
}, Dt = new WeakMap(), ve = new WeakMap(), Ut = new WeakMap(), Fe = new WeakMap(), Y0 = new WeakSet(), ds = function() {
  return g(this, Dt).readSync(["#mvrPackageDataLoader", g(this, ve) ?? ""], () => {
    var n;
    const e = new jr(async (a) => {
      if (!g(this, ve)) throw new Error(`MVR Api URL is not set for the current client (resolving ${a.join(", ")})`);
      const s = await Y(this, Y0, po).call(this, a);
      return a.map((r) => s[r] ?? /* @__PURE__ */ new Error(`Failed to resolve package: ${r}`));
    }), t = (n = g(this, Fe)) == null ? void 0 : n.packages;
    if (t) for (const [a, s] of Object.entries(t)) e.prime(a, s);
    return e;
  });
}, fs = function() {
  return g(this, Dt).readSync(["#mvrTypeDataLoader", g(this, ve) ?? ""], () => {
    var n;
    const e = new jr(async (a) => {
      if (!g(this, ve)) throw new Error(`MVR Api URL is not set for the current client (resolving ${a.join(", ")})`);
      const s = await Y(this, Y0, mo).call(this, a);
      return a.map((r) => s[r] ?? /* @__PURE__ */ new Error(`Failed to resolve type: ${r}`));
    }), t = (n = g(this, Fe)) == null ? void 0 : n.types;
    if (t) for (const [a, s] of Object.entries(t)) e.prime(a, s);
    return e;
  });
}, po = async function(e) {
  if (e.length === 0) return {};
  const t = Xn(e, g(this, Ut)), n = {};
  return await Promise.all(t.map(async (a) => {
    var r;
    const s = await Y(this, Y0, us).call(this, "/v1/resolution/bulk", { names: a });
    if (s != null && s.resolution)
      for (const i of Object.keys(s == null ? void 0 : s.resolution)) {
        const c = (r = s.resolution[i]) == null ? void 0 : r.package_id;
        c && (n[i] = c);
      }
  })), n;
}, mo = async function(e) {
  if (e.length === 0) return {};
  const t = Xn(e, g(this, Ut)), n = {};
  return await Promise.all(t.map(async (a) => {
    var r;
    const s = await Y(this, Y0, us).call(this, "/v1/struct-definition/bulk", { types: a });
    if (s != null && s.resolution)
      for (const i of Object.keys(s == null ? void 0 : s.resolution)) {
        const c = (r = s.resolution[i]) == null ? void 0 : r.type_tag;
        c && (n[i] = c);
      }
  })), n;
}, us = async function(e, t) {
  if (!g(this, ve)) throw new Error("MVR Api URL is not set for the current client");
  const n = await fetch(`${g(this, ve)}${e}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...zu
    },
    body: JSON.stringify(t)
  });
  if (!n.ok) {
    const a = await n.json().catch(() => ({}));
    throw new Error(`Failed to resolve types: ${a == null ? void 0 : a.message}`);
  }
  return n.json();
}, hi);
function Wu(e) {
  if (e != null && e.packages) for (const [t, n] of Object.entries(e.packages)) {
    if (!wn(t)) throw new Error(`Invalid package name: ${t}`);
    if (!cn(H(n))) throw new Error(`Invalid package ID: ${n}`);
  }
  if (e != null && e.types) for (const [t, n] of Object.entries(e.types)) {
    if (ot(t).typeParams.length > 0) throw new Error("Type overrides must be first-level only. If you want to supply generic types, just pass each type individually.");
    if (!cn(ot(n).address)) throw new Error(`Invalid type: ${n}`);
  }
}
function Kn(e, t = /* @__PURE__ */ new Set()) {
  if (typeof e == "string" && !Se(e)) return t;
  if (typeof e == "string" && e.startsWith("vector<") && e.endsWith(">")) return Kn(e.slice(7, -1), t);
  const n = go(e) ? e : ot(e);
  Se(n.address) && t.add(`${n.address}::${n.module}::${n.name}`);
  for (const a of n.typeParams) Kn(a, t);
  return t;
}
function ea(e, t) {
  if (typeof e == "string" && !e.includes("::")) return e;
  if (typeof e == "string" && e.startsWith("vector<") && e.endsWith(">")) return `vector<${ea(e.slice(7, -1), t)}>`;
  const n = go(e) ? e : ot(e), a = t[`${n.address}::${n.module}::${n.name}`];
  return ye({
    ...n,
    address: a ? a.split("::")[0] : n.address,
    typeParams: n.typeParams.map((s) => ea(s, t))
  });
}
function Se(e) {
  return e.includes(Lu) || e.includes("@") || e.includes(".sui");
}
function Un(e, t) {
  return t ? t.aborted ? Promise.reject(t.reason) : new Promise((n, a) => {
    const s = () => a(t.reason);
    t.addEventListener("abort", s, { once: !0 }), e.then(n, a).finally(() => {
      t.removeEventListener("abort", s);
    });
  }) : e;
}
function go(e) {
  return typeof e == "object" && "address" in e && "module" in e && "name" in e && "typeParams" in e;
}
function Qu(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const a of e.commands) switch (a.$kind) {
    case "MakeMoveVec":
      a.MakeMoveVec.type && Dr([a.MakeMoveVec.type]).forEach((i) => {
        n.add(i);
      });
      break;
    case "MoveCall":
      const s = a.MoveCall, r = s.package.split("::")[0];
      if (Se(r)) {
        if (!wn(r)) throw new Error(`Invalid package name: ${r}`);
        t.add(r);
      }
      Dr(s.typeArguments ?? []).forEach((i) => {
        n.add(i);
      });
      break;
  }
  return {
    packages: [...t],
    types: [...n]
  };
}
function Ju(e, t) {
  var n;
  for (const a of e.commands) {
    if ((n = a.MakeMoveVec) != null && n.type) {
      if (!Se(a.MakeMoveVec.type)) continue;
      if (!t.types[a.MakeMoveVec.type]) throw new Error(`No resolution found for type: ${a.MakeMoveVec.type}`);
      a.MakeMoveVec.type = t.types[a.MakeMoveVec.type].type;
    }
    const s = a.MoveCall;
    if (!s) continue;
    const r = s.package.split("::"), i = r[0];
    if (Se(i) && !t.packages[i]) throw new Error(`No address found for package: ${i}`);
    Se(i) && (r[0] = t.packages[i].package, s.package = r.join("::"));
    const c = s.typeArguments;
    if (c) {
      for (let o = 0; o < c.length; o++)
        if (Se(c[o])) {
          if (!t.types[c[o]]) throw new Error(`No resolution found for type: ${c[o]}`);
          c[o] = t.types[c[o]].type;
        }
      s.typeArguments = c;
    }
  }
}
function Dr(e) {
  const t = /* @__PURE__ */ new Set();
  for (const n of e) if (Se(n)) {
    if (!Lf(n)) throw new Error(`Invalid type with names: ${n}`);
    t.add(n);
  }
  return t;
}
function Yu() {
  return async (e, t, n) => {
    const a = Qu(e);
    if (a.types.length === 0 && a.packages.length === 0) return n();
    if (!t.client) throw new Error("Transaction contains MVR names but no client was provided to resolve them. Please pass a client to Transaction#build()");
    Ju(e, await t.client.core.mvr.resolve({
      types: a.types,
      packages: a.packages
    })), await n();
  };
}
function Ua(e, t = 1 / 0) {
  const n = {
    $kind: "Result",
    get Result() {
      return typeof e == "function" ? e() : e;
    }
  }, a = [], s = (r) => a[r] ?? (a[r] = {
    $kind: "NestedResult",
    get NestedResult() {
      return [typeof e == "function" ? e() : e, r];
    }
  });
  return new Proxy(n, {
    set() {
      throw new Error("The transaction result is a proxy, and does not support setting properties directly");
    },
    get(r, i) {
      if (i in r) return Reflect.get(r, i);
      if (i === Symbol.iterator) return function* () {
        let o = 0;
        for (; o < t; )
          yield s(o), o++;
      };
      if (typeof i == "symbol") return;
      const c = parseInt(i, 10);
      if (!(Number.isNaN(c) || c < 0))
        return s(c);
    }
  });
}
const ho = Symbol.for("@mysten/transaction");
function Zu(e) {
  return !!e && typeof e == "object" && e[ho] === !0;
}
var Ke, et, Ie, pe, H0, q0, re, $e, V, r0, Ao, Pn, Ht, Vn, Fn, ls, bs, yo, wo, ct, ga = (ct = class {
  constructor() {
    o0(this, r0);
    o0(this, Ke);
    o0(this, et);
    o0(this, Ie, /* @__PURE__ */ new Map());
    o0(this, pe, []);
    o0(this, H0, []);
    o0(this, q0, /* @__PURE__ */ new Set());
    o0(this, re, /* @__PURE__ */ new Set());
    o0(this, $e, /* @__PURE__ */ new Map());
    o0(this, V);
    this.object = Vu((t) => {
      var s, r;
      if (typeof t == "function") return this.object(this.add(t));
      if (typeof t == "object" && /* @__PURE__ */ ts(w0, t)) return t;
      const n = Yn(t), a = g(this, V).inputs.find((i) => n === Yn(i));
      return (s = a == null ? void 0 : a.Object) != null && s.SharedObject && typeof t == "object" && ((r = t.Object) != null && r.SharedObject) && (a.Object.SharedObject.mutable = a.Object.SharedObject.mutable || t.Object.SharedObject.mutable), a ? {
        $kind: "Input",
        Input: g(this, V).inputs.indexOf(a),
        type: "object"
      } : Y(this, r0, Ht).call(this, "object", typeof t == "string" ? {
        $kind: "UnresolvedObject",
        UnresolvedObject: { objectId: H(t) }
      } : t);
    }), W(this, V, new _t()), W(this, et, []), W(this, Ke, []);
  }
  /**
  * Converts from a serialize transaction kind (built with `build({ onlyTransactionKind: true })`) to a `Transaction` class.
  * Supports either a byte array, or base64-encoded bytes.
  */
  static fromKind(t) {
    const n = new ct();
    return W(n, V, _t.fromKindBytes(typeof t == "string" ? ae(t) : t)), W(n, pe, g(n, V).inputs.slice()), W(n, H0, g(n, V).commands.slice()), W(n, q0, new Set(g(n, H0).map((a, s) => s))), n;
  }
  /**
  * Converts from a serialized transaction format to a `Transaction` class.
  * There are two supported serialized formats:
  * - A string returned from `Transaction#serialize`. The serialized format must be compatible, or it will throw an error.
  * - A byte array (or base64-encoded bytes) containing BCS transaction data.
  *
  * When copying an in-memory transaction that uses custom intents, pass resolvers for those intents
  * via `options.intentResolvers` so the copy can be created synchronously without first awaiting
  * `prepareForSerialization`. Built-in intents (such as `CoinWithBalance`) are handled automatically.
  */
  static from(t, n = {}) {
    const a = new ct();
    Zu(t) ? W(a, V, _t.restore(t.getData())) : typeof t != "string" || !t.startsWith("{") ? W(a, V, _t.fromBytes(typeof t == "string" ? ae(t) : t)) : W(a, V, _t.restore(JSON.parse(t))), W(a, pe, g(a, V).inputs.slice()), W(a, H0, g(a, V).commands.slice()), W(a, q0, new Set(g(a, H0).map((r, i) => i)));
    const s = new Map([[Ot, Ps], ...Object.entries(n.intentResolvers ?? {})]);
    if (!a.isPreparedForSerialization({ supportedIntents: [...s.keys()] })) throw new Error("Transaction has unresolved intents or async thunks. Provide resolvers for any custom intents via the `intentResolvers` option, or call `prepareForSerialization` before copying.");
    for (const [r, i] of s) a.addIntentResolver(r, i);
    return a;
  }
  addSerializationPlugin(t) {
    g(this, Ke).push(t);
  }
  addBuildPlugin(t) {
    g(this, et).push(t);
  }
  addIntentResolver(t, n) {
    if (g(this, Ie).has(t) && g(this, Ie).get(t) !== n) throw new Error(`Intent resolver for ${t} already exists`);
    g(this, Ie).set(t, n);
  }
  setSender(t) {
    g(this, V).sender = t;
  }
  /**
  * Sets the sender only if it has not already been set.
  * This is useful for sponsored transaction flows where the sender may not be the same as the signer address.
  */
  setSenderIfNotSet(t) {
    g(this, V).sender || (g(this, V).sender = t);
  }
  setExpiration(t) {
    g(this, V).expiration = t ? y0(Ic, t) : null;
  }
  setGasPrice(t) {
    g(this, V).gasData.price = String(t);
  }
  setGasBudget(t) {
    g(this, V).gasData.budget = String(t);
  }
  setGasBudgetIfNotSet(t) {
    g(this, V).gasData.budget == null && (g(this, V).gasData.budget = String(t));
  }
  setGasOwner(t) {
    g(this, V).gasData.owner = t;
  }
  setGasPayment(t) {
    g(this, V).gasData.payment = t.map((n) => y0(dt, n));
  }
  /** Get a snapshot of the transaction data, in JSON form: */
  getData() {
    return g(this, V).snapshot();
  }
  get [ho]() {
    return !0;
  }
  get pure() {
    return Object.defineProperty(this, "pure", {
      enumerable: !1,
      value: Fu((t) => Ka(t) ? Y(this, r0, Ht).call(this, "pure", {
        $kind: "Pure",
        Pure: { bytes: t.toBase64() }
      }) : Y(this, r0, Ht).call(this, "pure", /* @__PURE__ */ ts(Tr, t) ? y0(Tr, t) : t instanceof Uint8Array ? P0.Pure(t) : {
        $kind: "UnresolvedPure",
        UnresolvedPure: { value: t }
      }))
    }), this.pure;
  }
  /** Returns an argument for the gas coin, to be used in a transaction. */
  get gas() {
    return {
      $kind: "GasCoin",
      GasCoin: !0
    };
  }
  /**
  * Creates a coin of the specified type and balance.
  * Sourced from address balance when available, falling back to owned coins.
  */
  coin({ type: t, balance: n, useGasCoin: a }) {
    return this.add(H5({
      type: t,
      balance: n,
      useGasCoin: a
    }));
  }
  /**
  * Creates a Balance object of the specified type and balance.
  * Sourced from address balance when available, falling back to owned coins.
  */
  balance({ type: t, balance: n, useGasCoin: a }) {
    return this.add(q5({
      type: t,
      balance: n,
      useGasCoin: a
    }));
  }
  /**
  * Add a new object input to the transaction using the fully-resolved object reference.
  * If you only have an object ID, use `builder.object(id)` instead.
  */
  objectRef(...t) {
    return this.object(P0.ObjectRef(...t));
  }
  /**
  * Add a new receiving input to the transaction using the fully-resolved object reference.
  * If you only have an object ID, use `builder.object(id)` instead.
  */
  receivingRef(...t) {
    return this.object(P0.ReceivingRef(...t));
  }
  /**
  * Add a new shared object input to the transaction using the fully-resolved shared object reference.
  * If you only have an object ID, use `builder.object(id)` instead.
  */
  sharedObjectRef(...t) {
    return this.object(P0.SharedObjectRef(...t));
  }
  add(t) {
    if (typeof t == "function") {
      if (g(this, $e).has(t)) return g(this, $e).get(t);
      const n = Y(this, r0, Ao).call(this), a = t(n);
      if (!(a && typeof a == "object" && "then" in a))
        return W(this, q0, g(n, q0)), g(this, $e).set(t, a), a;
      const s = Y(this, r0, Pn).call(this, {
        $kind: "$Intent",
        $Intent: {
          name: "AsyncTransactionThunk",
          inputs: {},
          data: {
            resultIndex: g(this, V).commands.length,
            result: null
          }
        }
      });
      g(this, re).add(Promise.resolve(a).then((i) => {
        s.$Intent.data.result = i;
      }));
      const r = Ua(() => s.$Intent.data.resultIndex);
      return g(this, $e).set(t, r), r;
    } else Y(this, r0, Pn).call(this, t);
    return Ua(g(this, V).commands.length - 1);
  }
  splitCoins(t, n) {
    const a = R0.SplitCoins(typeof t == "string" ? this.object(t) : Y(this, r0, Fn).call(this, t), n.map((s) => typeof s == "number" || typeof s == "bigint" || typeof s == "string" ? this.pure.u64(s) : Y(this, r0, Vn).call(this, s)));
    return Y(this, r0, Pn).call(this, a), Ua(g(this, V).commands.length - 1, n.length);
  }
  mergeCoins(t, n) {
    return this.add(R0.MergeCoins(this.object(t), n.map((a) => this.object(a))));
  }
  publish({ modules: t, dependencies: n }) {
    return this.add(R0.Publish({
      modules: t,
      dependencies: n
    }));
  }
  upgrade({ modules: t, dependencies: n, package: a, ticket: s }) {
    return this.add(R0.Upgrade({
      modules: t,
      dependencies: n,
      package: a,
      ticket: this.object(s)
    }));
  }
  moveCall({ arguments: t, ...n }) {
    return this.add(R0.MoveCall({
      ...n,
      arguments: t == null ? void 0 : t.map((a) => Y(this, r0, Vn).call(this, a))
    }));
  }
  transferObjects(t, n) {
    return this.add(R0.TransferObjects(t.map((a) => this.object(a)), typeof n == "string" ? this.pure.address(n) : Y(this, r0, Vn).call(this, n)));
  }
  makeMoveVec({ type: t, elements: n }) {
    return this.add(R0.MakeMoveVec({
      type: t,
      elements: n.map((a) => this.object(a))
    }));
  }
  /**
  * Create a FundsWithdrawal input for withdrawing Balance<T> from an address balance accumulator.
  * This is used for gas payments from address balances.
  *
  * @param options.amount - The Amount to withdraw (u64).
  * @param options.type - The balance type (e.g., "0x2::sui::SUI"). Defaults to SUI.
  */
  withdrawal({ amount: t, type: n }) {
    const a = {
      $kind: "FundsWithdrawal",
      FundsWithdrawal: {
        reservation: {
          $kind: "MaxAmountU64",
          MaxAmountU64: String(t)
        },
        typeArg: {
          $kind: "Balance",
          Balance: n ?? "0x2::sui::SUI"
        },
        withdrawFrom: {
          $kind: "Sender",
          Sender: !0
        }
      }
    };
    return Y(this, r0, Ht).call(this, "object", a);
  }
  /**
  * @deprecated Use toJSON instead.
  * For synchronous serialization, you can use `getData()`
  * */
  serialize() {
    return JSON.stringify(C5(g(this, V).snapshot()));
  }
  async toJSON(t = {}) {
    await this.prepareForSerialization(t);
    const n = this.isFullyResolved();
    return JSON.stringify(y0(ru, n ? {
      ...g(this, V).snapshot(),
      digest: g(this, V).getDigest()
    } : g(this, V).snapshot()), (a, s) => typeof s == "bigint" ? s.toString() : s, 2);
  }
  /** Build the transaction to BCS bytes, and sign it with the provided keypair. */
  async sign(t) {
    const { signer: n, ...a } = t, s = await this.build(a);
    return n.signTransaction(s);
  }
  /**
  * Checks if the transaction is prepared for serialization to JSON.
  * This means:
  *  - All async thunks have been fully resolved
  *  - All transaction intents have been resolved (unless in supportedIntents)
  *
  * Unlike `isFullyResolved()`, this does not require the sender, gas payment,
  * budget, or object versions to be set.
  */
  isPreparedForSerialization(t = {}) {
    return !(g(this, re).size > 0 || g(this, V).commands.some((n) => {
      var a;
      return n.$Intent && !((a = t.supportedIntents) != null && a.includes(n.$Intent.name));
    }));
  }
  /**
  *  Ensures that:
  *  - All objects have been fully resolved to a specific version
  *  - All pure inputs have been serialized to bytes
  *  - All async thunks have been fully resolved
  *  - All transaction intents have been resolved
  * 	- The gas payment, budget, and price have been set
  *  - The transaction sender has been set
  *
  *  When true, the transaction will always be built to the same bytes and digest (unless the transaction is mutated)
  */
  isFullyResolved() {
    return !(!this.isPreparedForSerialization() || !g(this, V).sender || bo(g(this, V), {}));
  }
  /** Build the transaction to BCS bytes. */
  async build(t = {}) {
    return await this.prepareForSerialization(t), await Y(this, r0, ls).call(this, t), g(this, V).build({ onlyTransactionKind: t.onlyTransactionKind });
  }
  /** Derive transaction digest */
  async getDigest(t = {}) {
    return await this.prepareForSerialization(t), await Y(this, r0, ls).call(this, t), g(this, V).getDigest();
  }
  async prepareForSerialization(t) {
    var s;
    await Y(this, r0, yo).call(this), Y(this, r0, wo).call(this);
    const n = /* @__PURE__ */ new Set();
    for (const r of g(this, V).commands) r.$Intent && n.add(r.$Intent.name);
    const a = [...g(this, Ke)];
    for (const r of n)
      if (!((s = t.supportedIntents) != null && s.includes(r))) {
        if (!g(this, Ie).has(r)) throw new Error(`Missing intent resolver for ${r}`);
        a.push(g(this, Ie).get(r));
      }
    a.push(Yu()), await Y(this, r0, bs).call(this, a, t);
  }
}, Ke = new WeakMap(), et = new WeakMap(), Ie = new WeakMap(), pe = new WeakMap(), H0 = new WeakMap(), q0 = new WeakMap(), re = new WeakMap(), $e = new WeakMap(), V = new WeakMap(), r0 = new WeakSet(), Ao = function() {
  const t = new ct();
  return W(t, V, g(this, V)), W(t, Ke, g(this, Ke)), W(t, et, g(this, et)), W(t, Ie, g(this, Ie)), W(t, re, g(this, re)), W(t, q0, new Set(g(this, q0))), W(t, $e, g(this, $e)), g(this, pe).push(g(t, pe)), g(this, H0).push(g(t, H0)), t;
}, Pn = function(t) {
  const n = g(this, V).commands.length;
  return g(this, H0).push(t), g(this, q0).add(n), g(this, V).commands.push(t), g(this, V).mapCommandArguments(n, (a) => {
    if (a.$kind === "Result" && !g(this, q0).has(a.Result)) throw new Error(`Result { Result: ${a.Result} } is not available to use in the current transaction`);
    if (a.$kind === "NestedResult" && !g(this, q0).has(a.NestedResult[0])) throw new Error(`Result { NestedResult: [${a.NestedResult[0]}, ${a.NestedResult[1]}] } is not available to use in the current transaction`);
    if (a.$kind === "Input" && a.Input >= g(this, V).inputs.length) throw new Error(`Input { Input: ${a.Input} } references an input that does not exist in the current transaction`);
    return a;
  }), t;
}, Ht = function(t, n) {
  return g(this, pe).push(n), g(this, V).addInput(t, n);
}, Vn = function(t) {
  return Ka(t) ? this.pure(t) : Y(this, r0, Fn).call(this, t);
}, Fn = function(t) {
  if (typeof t == "function") {
    const n = this.add(t);
    return typeof n == "function" ? Y(this, r0, Fn).call(this, n) : y0(w0, n);
  }
  return y0(w0, t);
}, ls = async function(t) {
  if (!t.onlyTransactionKind && !g(this, V).sender) throw new Error("Missing transaction sender");
  await Y(this, r0, bs).call(this, [...g(this, et), Du], t);
}, bs = async function(t, n) {
  try {
    const a = (s) => {
      if (s >= t.length) return () => {
      };
      const r = t[s];
      return async () => {
        const i = a(s + 1);
        let c = !1, o = !1;
        if (await r(g(this, V), n, async () => {
          if (c) throw new Error(`next() was call multiple times in TransactionPlugin ${s}`);
          c = !0, await i(), o = !0;
        }), !c) throw new Error(`next() was not called in TransactionPlugin ${s}`);
        if (!o) throw new Error(`next() was not awaited in TransactionPlugin ${s}`);
      };
    };
    await a(0)();
  } finally {
    W(this, pe, g(this, V).inputs.slice()), W(this, H0, g(this, V).commands.slice()), W(this, q0, new Set(g(this, H0).map((a, s) => s)));
  }
}, yo = async function() {
  for (; g(this, re).size > 0; ) {
    const t = Promise.all(g(this, re));
    g(this, re).clear(), g(this, re).add(t), await t, g(this, re).delete(t);
  }
}, wo = function() {
  var c;
  const t = g(this, V).commands, n = g(this, V).inputs, a = g(this, H0).flat(1 / 0), s = g(this, pe).flat(1 / 0);
  if (a.length !== t.length) throw new Error("Unexpected number of commands found in transaction data");
  if (s.length !== n.length) throw new Error("Unexpected number of inputs found in transaction data");
  const r = a.filter((o) => {
    var d;
    return ((d = o.$Intent) == null ? void 0 : d.name) !== "AsyncTransactionThunk";
  });
  g(this, V).commands = r, g(this, V).inputs = s, W(this, H0, r), W(this, pe, s), W(this, q0, new Set(r.map((o, d) => d)));
  function i(o) {
    var l;
    const d = t[o];
    if (((l = d.$Intent) == null ? void 0 : l.name) === "AsyncTransactionThunk") {
      const b = d.$Intent.data.result;
      if (b == null) throw new Error("AsyncTransactionThunk has not been resolved");
      return i(b.Result);
    }
    const u = r.indexOf(d);
    if (u === -1) throw new Error("Unable to find original index for command");
    return u;
  }
  g(this, V).mapArguments((o) => {
    if (o.$kind === "Input") {
      const d = s.indexOf(n[o.Input]);
      if (d === -1) throw new Error("Input has not been resolved");
      return {
        ...o,
        Input: d
      };
    } else if (o.$kind === "Result") {
      const d = i(o.Result);
      return {
        ...o,
        Result: d
      };
    } else if (o.$kind === "NestedResult") {
      const d = i(o.NestedResult[0]);
      return {
        ...o,
        NestedResult: [d, o.NestedResult[1]]
      };
    }
    return o;
  });
  for (const [o, d] of t.entries()) if (((c = d.$Intent) == null ? void 0 : c.name) === "AsyncTransactionThunk") try {
    d.$Intent.data.resultIndex = i(o);
  } catch {
  }
}, ct), tt, F0, Pt, Hu = (Pt = class {
  constructor({ prefix: t, cache: n } = {}) {
    o0(this, tt);
    o0(this, F0);
    W(this, tt, t ?? []), W(this, F0, n ?? /* @__PURE__ */ new Map());
  }
  read(t, n) {
    const a = [g(this, tt), ...t].join(":");
    if (g(this, F0).has(a)) return g(this, F0).get(a);
    const s = n();
    return g(this, F0).set(a, s), typeof s == "object" && s !== null && "then" in s ? Promise.resolve(s).then((r) => (g(this, F0).set(a, r), r)).catch((r) => {
      throw g(this, F0).delete(a), r;
    }) : s;
  }
  readSync(t, n) {
    const a = [g(this, tt), ...t].join(":");
    if (g(this, F0).has(a)) return g(this, F0).get(a);
    const s = n();
    return g(this, F0).set(a, s), s;
  }
  clear(t) {
    const n = [...g(this, tt), ...t ?? []].join(":");
    if (!n) {
      g(this, F0).clear();
      return;
    }
    for (const a of g(this, F0).keys()) a.startsWith(n) && g(this, F0).delete(a);
  }
  scope(t) {
    return new Pt({
      prefix: [...g(this, tt), ...Array.isArray(t) ? t : [t]],
      cache: g(this, F0)
    });
  }
}, tt = new WeakMap(), F0 = new WeakMap(), Pt), To = class {
  constructor({ network: e, base: t, cache: n = (t == null ? void 0 : t.cache) ?? new Hu() }) {
    this.network = e, this.base = t ?? this, this.cache = n;
  }
  $extend(...e) {
    const t = Object.fromEntries(e.map((a) => [a.name, a.register(this)])), n = /* @__PURE__ */ new Map();
    return new Proxy(this, { get(a, s, r) {
      if (typeof s == "string" && s in t) return t[s];
      const i = Reflect.get(a, s, r);
      return typeof i == "function" ? s === "$extend" ? i.bind(r) : (n.has(s) || n.set(s, i.bind(a)), n.get(s)) : i;
    } });
  }
};
let vo = /* @__PURE__ */ function(e) {
  return e.Failure = "FAILURE", e.Success = "SUCCESS", e;
}({}), Ur = /* @__PURE__ */ function(e) {
  return e.PersonalMessage = "PERSONAL_MESSAGE", e.TransactionData = "TRANSACTION_DATA", e;
}({});
var v0 = class extends String {
  constructor(e, t) {
    super(e), this.value = e, this.__meta__ = t;
  }
  toString() {
    return this.value;
  }
};
new v0(`
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}
    `, { fragmentName: "OBJECT_OWNER_FIELDS" });
new v0(`
    fragment OBJECT_FIELDS on Object {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  asMoveObject {
    contents {
      bcs @include(if: $includeContent)
      json @include(if: $includeJson)
      display @include(if: $includeDisplay) {
        output
        errors
      }
      type {
        repr
      }
    }
  }
  asMovePackage {
    __typename
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`, { fragmentName: "OBJECT_FIELDS" });
new v0(`
    fragment MOVE_OBJECT_FIELDS on MoveObject {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  contents {
    bcs @include(if: $includeContent)
    json @include(if: $includeJson)
    display @include(if: $includeDisplay) {
      output
      errors
    }
    type {
      repr
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`, { fragmentName: "MOVE_OBJECT_FIELDS" });
new v0(`
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}
    `, { fragmentName: "TRANSACTION_FIELDS" });
const qu = new v0(`
    query getAllBalances($owner: SuiAddress!, $limit: Int, $cursor: String) {
  address(address: $owner) {
    balances(first: $limit, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        coinType {
          repr
        }
        totalBalance
        addressBalance
      }
    }
  }
}
    `), Xu = new v0(`
    query getBalance($owner: SuiAddress!, $coinType: String = "0x2::sui::SUI") {
  address(address: $owner) {
    balance(coinType: $coinType) {
      coinType {
        repr
      }
      totalBalance
      addressBalance
    }
  }
}
    `), Ku = new v0(`
    query getChainIdentifier {
  checkpoint(sequenceNumber: 0) {
    digest
  }
}
    `), el = new v0(`
    query getCoinMetadata($coinType: String!) {
  coinMetadata(coinType: $coinType) {
    address
    decimals
    name
    symbol
    description
    iconUrl
  }
}
    `), tl = new v0(`
    query getCoins($owner: SuiAddress!, $first: Int, $cursor: String, $type: String = "0x2::coin::Coin<0x2::sui::SUI>") {
  address(address: $owner) {
    address
    objects(first: $first, after: $cursor, filter: {type: $type}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        owner {
          ...OBJECT_OWNER_FIELDS
        }
        contents {
          json
          type {
            repr
          }
        }
        address
        version
        digest
      }
    }
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`), nl = new v0(`
    query getCurrentSystemState {
  epoch {
    epochId
    referenceGasPrice
    startTimestamp
    protocolConfigs {
      protocolVersion
    }
    systemState {
      json
    }
  }
}
    `), al = new v0(`
    query getDynamicFields($parentId: SuiAddress!, $first: Int, $cursor: String, $includeValue: Boolean = false) {
  address(address: $parentId) {
    dynamicFields(first: $first, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name {
          bcs
          type {
            repr
          }
        }
        value {
          __typename
          ... on MoveValue {
            bcs @include(if: $includeValue)
            type {
              repr
            }
          }
          ... on MoveObject {
            address
            contents {
              bcs @include(if: $includeValue)
              type {
                repr
              }
            }
          }
        }
      }
    }
  }
}
    `), sl = new v0(`
    query getMoveFunction($package: SuiAddress!, $module: String!, $function: String!) {
  package(address: $package) {
    module(name: $module) {
      function(name: $function) {
        name
        visibility
        isEntry
        typeParameters {
          constraints
        }
        parameters {
          signature
        }
        return {
          signature
        }
      }
    }
  }
}
    `), rl = new v0(`
    query getProtocolConfig {
  epoch {
    protocolConfigs {
      protocolVersion
      featureFlags {
        key
        value
      }
      configs {
        key
        value
      }
    }
  }
}
    `), il = new v0(`
    query getReferenceGasPrice {
  epoch {
    referenceGasPrice
  }
}
    `), cl = new v0(`
    query listEvents($filter: EventFilter, $first: Int, $after: String, $last: Int, $before: String) {
  events(
    filter: $filter
    first: $first
    after: $after
    last: $last
    before: $before
  ) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    nodes {
      sequenceNumber
      transaction {
        digest
        effects {
          checkpoint {
            sequenceNumber
          }
        }
      }
      transactionModule {
        package {
          address
        }
        name
      }
      sender {
        address
      }
      contents {
        type {
          repr
        }
        bcs
        json
      }
    }
  }
}
    `), ol = new v0(`
    query defaultSuinsName($address: SuiAddress!) {
  address(address: $address) {
    defaultNameRecord {
      domain
    }
  }
}
    `), dl = new v0(`
    query resolveNameServiceAddress($name: String!) {
  address(name: $name) {
    address
  }
}
    `), fl = new v0(`
    query getOwnedObjects($owner: SuiAddress!, $limit: Int, $cursor: String, $filter: ObjectFilter, $includeContent: Boolean = false, $includePreviousTransaction: Boolean = false, $includeObjectBcs: Boolean = false, $includeJson: Boolean = false, $includeDisplay: Boolean = false) {
  address(address: $owner) {
    objects(first: $limit, after: $cursor, filter: $filter) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...MOVE_OBJECT_FIELDS
      }
    }
  }
}
    fragment MOVE_OBJECT_FIELDS on MoveObject {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  contents {
    bcs @include(if: $includeContent)
    json @include(if: $includeJson)
    display @include(if: $includeDisplay) {
      output
      errors
    }
    type {
      repr
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`), ul = new v0(`
    query multiGetObjects($objectKeys: [ObjectKey!]!, $includeContent: Boolean = false, $includePreviousTransaction: Boolean = false, $includeObjectBcs: Boolean = false, $includeJson: Boolean = false, $includeDisplay: Boolean = false) {
  multiGetObjects(keys: $objectKeys) {
    ...OBJECT_FIELDS
  }
}
    fragment OBJECT_FIELDS on Object {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  asMoveObject {
    contents {
      bcs @include(if: $includeContent)
      json @include(if: $includeJson)
      display @include(if: $includeDisplay) {
        output
        errors
      }
      type {
        repr
      }
    }
  }
  asMovePackage {
    __typename
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`), ll = new v0(`
    query simulateTransaction($transaction: JSON!, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeCommandResults: Boolean = false, $includeBcs: Boolean = false, $doGasSelection: Boolean = false, $checksEnabled: Boolean = true) {
  simulateTransaction(
    transaction: $transaction
    doGasSelection: $doGasSelection
    checksEnabled: $checksEnabled
  ) {
    effects {
      transaction {
        ...TRANSACTION_FIELDS
      }
    }
    outputs @include(if: $includeCommandResults) {
      returnValues {
        value {
          bcs
        }
      }
      mutatedReferences {
        value {
          bcs
        }
      }
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`), bl = new v0(`
    mutation executeTransaction($transactionDataBcs: Base64!, $signatures: [Base64!]!, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeBcs: Boolean = false) {
  executeTransaction(
    transactionDataBcs: $transactionDataBcs
    signatures: $signatures
  ) {
    effects {
      transaction {
        ...TRANSACTION_FIELDS
      }
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`), pl = new v0(`
    query getTransactionBlock($digest: String!, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeBcs: Boolean = false) {
  transaction(digest: $digest) {
    ...TRANSACTION_FIELDS
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`), ml = new v0(`
    query listTransactions($filter: TransactionFilter, $first: Int, $after: String, $last: Int, $before: String, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeBcs: Boolean = false) {
  transactions(
    filter: $filter
    first: $first
    after: $after
    last: $last
    before: $before
  ) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    nodes {
      ...TRANSACTION_FIELDS
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`), gl = new v0(`
    query resolveTransaction($transaction: JSON!, $doGasSelection: Boolean = true, $checksEnabled: Boolean = true) {
  simulateTransaction(
    transaction: $transaction
    doGasSelection: $doGasSelection
    checksEnabled: $checksEnabled
  ) {
    effects {
      transaction {
        transactionBcs
        effects {
          epoch {
            epochId
          }
          status
          executionError {
            message
            abortCode
            identifier
            constant
            sourceLineNumber
            instructionOffset
            module {
              name
              package {
                address
              }
            }
            function {
              name
            }
          }
        }
      }
    }
  }
}
    `), hl = new v0(`
    query verifyZkLoginSignature($bytes: Base64!, $signature: Base64!, $intentScope: ZkLoginIntentScope!, $author: SuiAddress!) {
  verifyZkLoginSignature(
    bytes: $bytes
    signature: $signature
    intentScope: $intentScope
    author: $author
  ) {
    success
  }
}
    `), Al = {
  mainnet: "https://mainnet.mvr.mystenlabs.com",
  testnet: "https://testnet.mvr.mystenlabs.com"
};
var yl = class extends To {
  constructor(e) {
    var t, n, a;
    super(e), this.core = this, this.mvr = new Gu({
      cache: this.cache.scope("core.mvr"),
      url: ((t = e.mvr) == null ? void 0 : t.url) ?? Al[this.network],
      pageSize: (n = e.mvr) == null ? void 0 : n.pageSize,
      overrides: (a = e.mvr) == null ? void 0 : a.overrides
    });
  }
  async getObject(e) {
    const { objectId: t } = e, { objects: [n] } = await this.getObjects({
      objectIds: [t],
      signal: e.signal,
      include: e.include
    });
    if (n instanceof Error) throw n;
    return { object: n };
  }
  async getDynamicField(e) {
    const t = Ft.parseFromStr((await this.core.mvr.resolveType({
      type: e.name.type,
      signal: e.signal
    })).type), n = In(e.parentId, t, e.name.bcs), { objects: [a] } = await this.getObjects({
      objectIds: [n],
      signal: e.signal,
      include: {
        previousTransaction: !0,
        content: !0
      }
    });
    if (a instanceof Error) throw a;
    const s = ot(a.type), r = await a.content, i = s.typeParams[0], c = typeof i != "string" && i.module === "dynamic_object_field" && i.name === "Wrapper", o = r.slice(la + e.name.bcs.length), d = typeof s.typeParams[1] == "string" ? s.typeParams[1] : ye(s.typeParams[1]);
    return { dynamicField: {
      $kind: c ? "DynamicObject" : "DynamicField",
      fieldId: a.objectId,
      digest: a.digest,
      version: a.version,
      type: a.type,
      previousTransaction: a.previousTransaction,
      name: {
        type: typeof i == "string" ? i : ye(i),
        bcs: e.name.bcs
      },
      value: {
        type: d,
        bcs: o
      },
      childId: c ? A.Address.parse(o) : void 0
    } };
  }
  async getDynamicObjectField(e) {
    const t = `0x2::dynamic_object_field::Wrapper<${(await this.core.mvr.resolveType({
      type: e.name.type,
      signal: e.signal
    })).type}>`, { dynamicField: n } = await this.getDynamicField({
      parentId: e.parentId,
      name: {
        type: t,
        bcs: e.name.bcs
      },
      signal: e.signal
    }), { object: a } = await this.getObject({
      objectId: n.childId,
      signal: e.signal,
      include: e.include
    });
    return { object: a };
  }
  async waitForTransaction(e) {
    const { signal: t, timeout: n = 60 * 1e3, pollSchedule: a, include: s } = e, r = "result" in e && e.result ? (e.result.Transaction ?? e.result.FailedTransaction).digest : e.digest, i = t ? AbortSignal.any([AbortSignal.timeout(n), t]) : AbortSignal.timeout(n), c = new Promise((b, p) => {
      i.addEventListener("abort", () => p(i.reason));
    });
    c.catch(() => {
    });
    const o = a ?? [
      0,
      300,
      600,
      1500,
      3500
    ], d = Date.now();
    let u = 0;
    const l = o.length > 0 ? o[o.length - 1] - (o[o.length - 2] ?? 0) : 2e3;
    for (; ; ) {
      if (u < o.length) {
        const b = d + o[u] - Date.now();
        u++, b > 0 && await Promise.race([new Promise((p) => setTimeout(p, b)), c]);
      } else await Promise.race([new Promise((b) => setTimeout(b, l)), c]);
      i.throwIfAborted();
      try {
        return await this.getTransaction({
          digest: r,
          include: s,
          signal: i
        });
      } catch {
      }
    }
  }
  async signAndExecuteTransaction({ transaction: e, signer: t, additionalSignatures: n = [], ...a }) {
    let s;
    e instanceof Uint8Array ? s = e : (e.setSenderIfNotSet(t.toSuiAddress()), s = await e.build({ client: this }));
    const { signature: r } = await t.signTransaction(s);
    return this.executeTransaction({
      transaction: s,
      signatures: [r, ...n],
      ...a
    });
  }
};
const wl = new Intl.PluralRules("en-US", { type: "ordinal" }), Tl = /* @__PURE__ */ new Map([
  ["one", "st"],
  ["two", "nd"],
  ["few", "rd"],
  ["other", "th"]
]);
function vl(e) {
  return `${e}${Tl.get(wl.select(e))}`;
}
function Io(e) {
  const { command: t, location: n, abortCode: a, cleverError: s } = e, r = [];
  if (t != null ? r.push(`MoveAbort in ${vl(t + 1)} command`) : r.push("MoveAbort"), s != null && s.constantName) {
    const i = s.value ? `'${s.constantName}': ${s.value}` : `'${s.constantName}'`;
    r.push(i);
  } else r.push(`abort code: ${a}`);
  if (n != null && n.package && (n != null && n.module)) {
    const i = [`in '${[
      n.package.startsWith("0x") ? n.package : `0x${n.package}`,
      n.module,
      n.functionName
    ].filter(Boolean).join("::")}'`];
    (s == null ? void 0 : s.lineNumber) != null ? i.push(`(line ${s.lineNumber})`) : n.instruction != null && i.push(`(instruction ${n.instruction})`), r.push(i.join(" "));
  }
  return r.join(", ");
}
const Pr = A.struct("MinimalEffectsWithError", { status: Rs });
A.enum("MinimalTransactionEffectsWithError", {
  V1: Pr,
  V2: Pr
});
const Il = A.enum("MinimalExecutionStatusNoError", {
  Success: null,
  Failed: null
}), Vr = A.struct("MinimalEffectsNoError", { status: Il });
A.enum("MinimalTransactionEffectsNoError", {
  V1: Vr,
  V2: Vr
});
function Z0(e, t) {
  return t != null && typeof t != "boolean" ? `${e}(${JSON.stringify(t, (n, a) => typeof a == "bigint" ? a.toString() : a)})` : e;
}
function Ol(e) {
  const t = e.error, n = e.command != null ? Number(e.command) : void 0;
  switch (t.$kind) {
    case "MoveAbort": {
      const [a, s] = t.MoveAbort, r = {
        package: a.module.address,
        module: a.module.name,
        function: a.function,
        functionName: a.functionName ?? void 0,
        instruction: a.instruction
      };
      return {
        $kind: "MoveAbort",
        message: Io({
          command: n,
          location: r,
          abortCode: String(s)
        }),
        command: n,
        MoveAbort: {
          abortCode: String(s),
          location: r
        }
      };
    }
    case "MoveObjectTooBig":
      return {
        $kind: "SizeError",
        message: Z0("MoveObjectTooBig", t.MoveObjectTooBig),
        command: n,
        SizeError: {
          name: "ObjectTooBig",
          size: Number(t.MoveObjectTooBig.objectSize),
          maxSize: Number(t.MoveObjectTooBig.maxObjectSize)
        }
      };
    case "MovePackageTooBig":
      return {
        $kind: "SizeError",
        message: Z0("MovePackageTooBig", t.MovePackageTooBig),
        command: n,
        SizeError: {
          name: "PackageTooBig",
          size: Number(t.MovePackageTooBig.objectSize),
          maxSize: Number(t.MovePackageTooBig.maxObjectSize)
        }
      };
    case "EffectsTooLarge":
      return {
        $kind: "SizeError",
        message: Z0("EffectsTooLarge", t.EffectsTooLarge),
        command: n,
        SizeError: {
          name: "EffectsTooLarge",
          size: Number(t.EffectsTooLarge.currentSize),
          maxSize: Number(t.EffectsTooLarge.maxSize)
        }
      };
    case "WrittenObjectsTooLarge":
      return {
        $kind: "SizeError",
        message: Z0("WrittenObjectsTooLarge", t.WrittenObjectsTooLarge),
        command: n,
        SizeError: {
          name: "WrittenObjectsTooLarge",
          size: Number(t.WrittenObjectsTooLarge.currentSize),
          maxSize: Number(t.WrittenObjectsTooLarge.maxSize)
        }
      };
    case "MoveVectorElemTooBig":
      return {
        $kind: "SizeError",
        message: Z0("MoveVectorElemTooBig", t.MoveVectorElemTooBig),
        command: n,
        SizeError: {
          name: "MoveVectorElemTooBig",
          size: Number(t.MoveVectorElemTooBig.valueSize),
          maxSize: Number(t.MoveVectorElemTooBig.maxScaledSize)
        }
      };
    case "MoveRawValueTooBig":
      return {
        $kind: "SizeError",
        message: Z0("MoveRawValueTooBig", t.MoveRawValueTooBig),
        command: n,
        SizeError: {
          name: "MoveRawValueTooBig",
          size: Number(t.MoveRawValueTooBig.valueSize),
          maxSize: Number(t.MoveRawValueTooBig.maxScaledSize)
        }
      };
    case "CommandArgumentError":
      return {
        $kind: "CommandArgumentError",
        message: Z0("CommandArgumentError", t.CommandArgumentError),
        command: n,
        CommandArgumentError: {
          argument: t.CommandArgumentError.argIdx,
          name: t.CommandArgumentError.kind.$kind
        }
      };
    case "TypeArgumentError":
      return {
        $kind: "TypeArgumentError",
        message: Z0("TypeArgumentError", t.TypeArgumentError),
        command: n,
        TypeArgumentError: {
          typeArgument: t.TypeArgumentError.argumentIdx,
          name: t.TypeArgumentError.kind.$kind
        }
      };
    case "PackageUpgradeError": {
      const a = t.PackageUpgradeError.upgradeError;
      return {
        $kind: "PackageUpgradeError",
        message: Z0("PackageUpgradeError", t.PackageUpgradeError),
        command: n,
        PackageUpgradeError: {
          name: a.$kind,
          packageId: a.$kind === "UnableToFetchPackage" ? a.UnableToFetchPackage.packageId : void 0,
          digest: a.$kind === "DigestDoesNotMatch" ? cs(a.DigestDoesNotMatch.digest) : void 0
        }
      };
    }
    case "ExecutionCancelledDueToSharedObjectCongestion":
      return {
        $kind: "CongestedObjects",
        message: Z0("ExecutionCancelledDueToSharedObjectCongestion", t.ExecutionCancelledDueToSharedObjectCongestion),
        command: n,
        CongestedObjects: {
          name: "ExecutionCanceledDueToConsensusObjectCongestion",
          objects: t.ExecutionCancelledDueToSharedObjectCongestion.congested_objects
        }
      };
    case "AddressDeniedForCoin":
      return {
        $kind: "CoinDenyListError",
        message: Z0("AddressDeniedForCoin", t.AddressDeniedForCoin),
        command: n,
        CoinDenyListError: {
          name: "AddressDeniedForCoin",
          address: t.AddressDeniedForCoin.address,
          coinType: t.AddressDeniedForCoin.coinType
        }
      };
    case "CoinTypeGlobalPause":
      return {
        $kind: "CoinDenyListError",
        message: Z0("CoinTypeGlobalPause", t.CoinTypeGlobalPause),
        command: n,
        CoinDenyListError: {
          name: "CoinTypeGlobalPause",
          coinType: t.CoinTypeGlobalPause.coinType
        }
      };
    case "CircularObjectOwnership":
      return {
        $kind: "ObjectIdError",
        message: Z0("CircularObjectOwnership", t.CircularObjectOwnership),
        command: n,
        ObjectIdError: {
          name: "CircularObjectOwnership",
          objectId: t.CircularObjectOwnership.object
        }
      };
    case "InvalidGasObject":
      return {
        $kind: "ObjectIdError",
        message: "InvalidGasObject",
        command: n,
        ObjectIdError: {
          name: "InvalidGasObject",
          objectId: ""
        }
      };
    case "InputObjectDeleted":
      return {
        $kind: "ObjectIdError",
        message: "InputObjectDeleted",
        command: n,
        ObjectIdError: {
          name: "InputObjectDeleted",
          objectId: ""
        }
      };
    case "InvalidTransferObject":
      return {
        $kind: "ObjectIdError",
        message: "InvalidTransferObject",
        command: n,
        ObjectIdError: {
          name: "InvalidTransferObject",
          objectId: ""
        }
      };
    case "NonExclusiveWriteInputObjectModified":
      return {
        $kind: "Unknown",
        message: Z0("NonExclusiveWriteInputObjectModified", t.NonExclusiveWriteInputObjectModified),
        command: n,
        Unknown: null
      };
    case "InsufficientGas":
    case "InvariantViolation":
    case "FeatureNotYetSupported":
    case "InsufficientCoinBalance":
    case "CoinBalanceOverflow":
    case "PublishErrorNonZeroAddress":
    case "SuiMoveVerificationError":
    case "MovePrimitiveRuntimeError":
    case "VMVerificationOrDeserializationError":
    case "VMInvariantViolation":
    case "FunctionNotFound":
    case "ArityMismatch":
    case "TypeArityMismatch":
    case "NonEntryFunctionInvoked":
    case "UnusedValueWithoutDrop":
    case "InvalidPublicFunctionReturnType":
    case "PublishUpgradeMissingDependency":
    case "PublishUpgradeDependencyDowngrade":
    case "CertificateDenied":
    case "SuiMoveVerificationTimedout":
    case "SharedObjectOperationNotAllowed":
    case "ExecutionCancelledDueToRandomnessUnavailable":
    case "InvalidLinkage":
    case "InsufficientBalanceForWithdraw":
      return {
        $kind: "Unknown",
        message: t.$kind,
        command: n,
        Unknown: null
      };
    default:
      return {
        $kind: "Unknown",
        message: "Unknown error",
        command: n,
        Unknown: null
      };
  }
}
function El(e) {
  var t, n;
  try {
    return ((n = (t = A.TransactionData.parse(e).V1) == null ? void 0 : t.gasData.payment) == null ? void 0 : n.length) === 0;
  } catch {
    return !1;
  }
}
function Sl(e) {
  const t = A.TransactionEffects.parse(e);
  switch (t.$kind) {
    case "V1":
      return kl({
        effects: t.V1
      });
    case "V2":
      return Nl({
        bytes: e,
        effects: t.V2
      });
    default:
      throw new Error(`Unknown transaction effects version: ${t.$kind}`);
  }
}
function kl(e) {
  throw new Error("V1 effects are not supported yet");
}
function Nl({ bytes: e, effects: t }) {
  const n = t.changedObjects.map(([a, s]) => {
    var r, i, c, o, d, u;
    return {
      objectId: a,
      inputState: s.inputState.$kind === "Exist" ? "Exists" : "DoesNotExist",
      inputVersion: ((r = s.inputState.Exist) == null ? void 0 : r[0][0]) ?? null,
      inputDigest: ((i = s.inputState.Exist) == null ? void 0 : i[0][1]) ?? null,
      inputOwner: ((c = s.inputState.Exist) == null ? void 0 : c[1]) ?? null,
      outputState: s.outputState.$kind === "NotExist" ? "DoesNotExist" : s.outputState.$kind,
      outputVersion: s.outputState.$kind === "PackageWrite" ? (o = s.outputState.PackageWrite) == null ? void 0 : o[0] : s.outputState.$kind === "ObjectWrite" ? t.lamportVersion : null,
      outputDigest: s.outputState.$kind === "PackageWrite" ? (d = s.outputState.PackageWrite) == null ? void 0 : d[1] : s.outputState.$kind === "ObjectWrite" ? ((u = s.outputState.ObjectWrite) == null ? void 0 : u[0]) ?? null : null,
      outputOwner: s.outputState.$kind === "ObjectWrite" ? s.outputState.ObjectWrite[1] : null,
      idOperation: s.idOperation.$kind
    };
  });
  return {
    bcs: e,
    version: 2,
    status: t.status.$kind === "Success" ? {
      success: !0,
      error: null
    } : {
      success: !1,
      error: Ol(t.status.Failure)
    },
    gasUsed: t.gasUsed,
    transactionDigest: t.transactionDigest,
    gasObject: t.gasObjectIndex === null ? null : n[t.gasObjectIndex] ?? null,
    eventsDigest: t.eventsDigest,
    dependencies: t.dependencies,
    lamportVersion: t.lamportVersion,
    changedObjects: n,
    unchangedConsensusObjects: t.unchangedConsensusObjects.map(([a, s]) => ({
      kind: s.$kind,
      objectId: a,
      version: s.$kind === "ReadOnlyRoot" ? s.ReadOnlyRoot[0] : s[s.$kind],
      digest: s.$kind === "ReadOnlyRoot" ? s.ReadOnlyRoot[1] : null
    })),
    auxiliaryDataDigest: t.auxDataDigest
  };
}
function St(e) {
  let t = typeof e;
  if (t == "object") {
    if (Array.isArray(e))
      return "array";
    if (e === null)
      return "null";
  }
  return t;
}
function Oo(e) {
  return e !== null && typeof e == "object" && !Array.isArray(e);
}
let Le = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""), ha = [];
for (let e = 0; e < Le.length; e++)
  ha[Le[e].charCodeAt(0)] = e;
ha[45] = Le.indexOf("+");
ha[95] = Le.indexOf("/");
function Cl(e) {
  let t = e.length * 3 / 4;
  e[e.length - 2] == "=" ? t -= 2 : e[e.length - 1] == "=" && (t -= 1);
  let n = new Uint8Array(t), a = 0, s = 0, r, i = 0;
  for (let c = 0; c < e.length; c++) {
    if (r = ha[e.charCodeAt(c)], r === void 0)
      switch (e[c]) {
        case "=":
          s = 0;
        case `
`:
        case "\r":
        case "	":
        case " ":
          continue;
        default:
          throw Error("invalid base64 string.");
      }
    switch (s) {
      case 0:
        i = r, s = 1;
        break;
      case 1:
        n[a++] = i << 2 | (r & 48) >> 4, i = r, s = 2;
        break;
      case 2:
        n[a++] = (i & 15) << 4 | (r & 60) >> 2, i = r, s = 3;
        break;
      case 3:
        n[a++] = (i & 3) << 6 | r, s = 0;
        break;
    }
  }
  if (s == 1)
    throw Error("invalid base64 string.");
  return n.subarray(0, a);
}
function xl(e) {
  let t = "", n = 0, a, s = 0;
  for (let r = 0; r < e.length; r++)
    switch (a = e[r], n) {
      case 0:
        t += Le[a >> 2], s = (a & 3) << 4, n = 1;
        break;
      case 1:
        t += Le[s | a >> 4], s = (a & 15) << 2, n = 2;
        break;
      case 2:
        t += Le[s | a >> 6], t += Le[a & 63], n = 0;
        break;
    }
  return n && (t += Le[s], t += "=", n == 1 && (t += "=")), t;
}
var ta;
(function(e) {
  e.symbol = Symbol.for("protobuf-ts/unknown"), e.onRead = (n, a, s, r, i) => {
    (t(a) ? a[e.symbol] : a[e.symbol] = []).push({ no: s, wireType: r, data: i });
  }, e.onWrite = (n, a, s) => {
    for (let { no: r, wireType: i, data: c } of e.list(a))
      s.tag(r, i).raw(c);
  }, e.list = (n, a) => {
    if (t(n)) {
      let s = n[e.symbol];
      return a ? s.filter((r) => r.no == a) : s;
    }
    return [];
  }, e.last = (n, a) => e.list(n, a).slice(-1)[0];
  const t = (n) => n && Array.isArray(n[e.symbol]);
})(ta || (ta = {}));
var C0;
(function(e) {
  e[e.Varint = 0] = "Varint", e[e.Bit64 = 1] = "Bit64", e[e.LengthDelimited = 2] = "LengthDelimited", e[e.StartGroup = 3] = "StartGroup", e[e.EndGroup = 4] = "EndGroup", e[e.Bit32 = 5] = "Bit32";
})(C0 || (C0 = {}));
function _l() {
  let e = 0, t = 0;
  for (let a = 0; a < 28; a += 7) {
    let s = this.buf[this.pos++];
    if (e |= (s & 127) << a, !(s & 128))
      return this.assertBounds(), [e, t];
  }
  let n = this.buf[this.pos++];
  if (e |= (n & 15) << 28, t = (n & 112) >> 4, !(n & 128))
    return this.assertBounds(), [e, t];
  for (let a = 3; a <= 31; a += 7) {
    let s = this.buf[this.pos++];
    if (t |= (s & 127) << a, !(s & 128))
      return this.assertBounds(), [e, t];
  }
  throw new Error("invalid varint");
}
function Pa(e, t, n) {
  for (let r = 0; r < 28; r = r + 7) {
    const i = e >>> r, c = !(!(i >>> 7) && t == 0), o = (c ? i | 128 : i) & 255;
    if (n.push(o), !c)
      return;
  }
  const a = e >>> 28 & 15 | (t & 7) << 4, s = !!(t >> 3);
  if (n.push((s ? a | 128 : a) & 255), !!s) {
    for (let r = 3; r < 31; r = r + 7) {
      const i = t >>> r, c = !!(i >>> 7), o = (c ? i | 128 : i) & 255;
      if (n.push(o), !c)
        return;
    }
    n.push(t >>> 31 & 1);
  }
}
const $n = 65536 * 65536;
function Eo(e) {
  let t = e[0] == "-";
  t && (e = e.slice(1));
  const n = 1e6;
  let a = 0, s = 0;
  function r(i, c) {
    const o = Number(e.slice(i, c));
    s *= n, a = a * n + o, a >= $n && (s = s + (a / $n | 0), a = a % $n);
  }
  return r(-24, -18), r(-18, -12), r(-12, -6), r(-6), [t, a, s];
}
function ps(e, t) {
  if (t >>> 0 <= 2097151)
    return "" + ($n * t + (e >>> 0));
  let n = e & 16777215, a = (e >>> 24 | t << 8) >>> 0 & 16777215, s = t >> 16 & 65535, r = n + a * 6777216 + s * 6710656, i = a + s * 8147497, c = s * 2, o = 1e7;
  r >= o && (i += Math.floor(r / o), r %= o), i >= o && (c += Math.floor(i / o), i %= o);
  function d(u, l) {
    let b = u ? String(u) : "";
    return l ? "0000000".slice(b.length) + b : b;
  }
  return d(
    c,
    /*needLeadingZeros=*/
    0
  ) + d(
    i,
    /*needLeadingZeros=*/
    c
  ) + // If the final 1e7 digit didn't need leading zeros, we would have
  // returned via the trivial code path at the top.
  d(
    r,
    /*needLeadingZeros=*/
    1
  );
}
function Fr(e, t) {
  if (e >= 0) {
    for (; e > 127; )
      t.push(e & 127 | 128), e = e >>> 7;
    t.push(e);
  } else {
    for (let n = 0; n < 9; n++)
      t.push(e & 127 | 128), e = e >> 7;
    t.push(1);
  }
}
function Bl() {
  let e = this.buf[this.pos++], t = e & 127;
  if (!(e & 128))
    return this.assertBounds(), t;
  if (e = this.buf[this.pos++], t |= (e & 127) << 7, !(e & 128))
    return this.assertBounds(), t;
  if (e = this.buf[this.pos++], t |= (e & 127) << 14, !(e & 128))
    return this.assertBounds(), t;
  if (e = this.buf[this.pos++], t |= (e & 127) << 21, !(e & 128))
    return this.assertBounds(), t;
  e = this.buf[this.pos++], t |= (e & 15) << 28;
  for (let n = 5; e & 128 && n < 10; n++)
    e = this.buf[this.pos++];
  if (e & 128)
    throw new Error("invalid varint");
  return this.assertBounds(), t >>> 0;
}
let l0;
function jl() {
  const e = new DataView(new ArrayBuffer(8));
  l0 = globalThis.BigInt !== void 0 && typeof e.getBigInt64 == "function" && typeof e.getBigUint64 == "function" && typeof e.setBigInt64 == "function" && typeof e.setBigUint64 == "function" ? {
    MIN: BigInt("-9223372036854775808"),
    MAX: BigInt("9223372036854775807"),
    UMIN: BigInt("0"),
    UMAX: BigInt("18446744073709551615"),
    C: BigInt,
    V: e
  } : void 0;
}
jl();
function So(e) {
  if (!e)
    throw new Error("BigInt unavailable, see https://github.com/timostamm/protobuf-ts/blob/v1.0.8/MANUAL.md#bigint-support");
}
const ko = /^-?[0-9]+$/, na = 4294967296, Sn = 2147483648;
class No {
  /**
   * Create a new instance with the given bits.
   */
  constructor(t, n) {
    this.lo = t | 0, this.hi = n | 0;
  }
  /**
   * Is this instance equal to 0?
   */
  isZero() {
    return this.lo == 0 && this.hi == 0;
  }
  /**
   * Convert to a native number.
   */
  toNumber() {
    let t = this.hi * na + (this.lo >>> 0);
    if (!Number.isSafeInteger(t))
      throw new Error("cannot convert to safe number");
    return t;
  }
}
class $0 extends No {
  /**
   * Create instance from a `string`, `number` or `bigint`.
   */
  static from(t) {
    if (l0)
      switch (typeof t) {
        case "string":
          if (t == "0")
            return this.ZERO;
          if (t == "")
            throw new Error("string is no integer");
          t = l0.C(t);
        case "number":
          if (t === 0)
            return this.ZERO;
          t = l0.C(t);
        case "bigint":
          if (!t)
            return this.ZERO;
          if (t < l0.UMIN)
            throw new Error("signed value for ulong");
          if (t > l0.UMAX)
            throw new Error("ulong too large");
          return l0.V.setBigUint64(0, t, !0), new $0(l0.V.getInt32(0, !0), l0.V.getInt32(4, !0));
      }
    else
      switch (typeof t) {
        case "string":
          if (t == "0")
            return this.ZERO;
          if (t = t.trim(), !ko.test(t))
            throw new Error("string is no integer");
          let [n, a, s] = Eo(t);
          if (n)
            throw new Error("signed value for ulong");
          return new $0(a, s);
        case "number":
          if (t == 0)
            return this.ZERO;
          if (!Number.isSafeInteger(t))
            throw new Error("number is no integer");
          if (t < 0)
            throw new Error("signed value for ulong");
          return new $0(t, t / na);
      }
    throw new Error("unknown value " + typeof t);
  }
  /**
   * Convert to decimal string.
   */
  toString() {
    return l0 ? this.toBigInt().toString() : ps(this.lo, this.hi);
  }
  /**
   * Convert to native bigint.
   */
  toBigInt() {
    return So(l0), l0.V.setInt32(0, this.lo, !0), l0.V.setInt32(4, this.hi, !0), l0.V.getBigUint64(0, !0);
  }
}
$0.ZERO = new $0(0, 0);
class f0 extends No {
  /**
   * Create instance from a `string`, `number` or `bigint`.
   */
  static from(t) {
    if (l0)
      switch (typeof t) {
        case "string":
          if (t == "0")
            return this.ZERO;
          if (t == "")
            throw new Error("string is no integer");
          t = l0.C(t);
        case "number":
          if (t === 0)
            return this.ZERO;
          t = l0.C(t);
        case "bigint":
          if (!t)
            return this.ZERO;
          if (t < l0.MIN)
            throw new Error("signed long too small");
          if (t > l0.MAX)
            throw new Error("signed long too large");
          return l0.V.setBigInt64(0, t, !0), new f0(l0.V.getInt32(0, !0), l0.V.getInt32(4, !0));
      }
    else
      switch (typeof t) {
        case "string":
          if (t == "0")
            return this.ZERO;
          if (t = t.trim(), !ko.test(t))
            throw new Error("string is no integer");
          let [n, a, s] = Eo(t);
          if (n) {
            if (s > Sn || s == Sn && a != 0)
              throw new Error("signed long too small");
          } else if (s >= Sn)
            throw new Error("signed long too large");
          let r = new f0(a, s);
          return n ? r.negate() : r;
        case "number":
          if (t == 0)
            return this.ZERO;
          if (!Number.isSafeInteger(t))
            throw new Error("number is no integer");
          return t > 0 ? new f0(t, t / na) : new f0(-t, -t / na).negate();
      }
    throw new Error("unknown value " + typeof t);
  }
  /**
   * Do we have a minus sign?
   */
  isNegative() {
    return (this.hi & Sn) !== 0;
  }
  /**
   * Negate two's complement.
   * Invert all the bits and add one to the result.
   */
  negate() {
    let t = ~this.hi, n = this.lo;
    return n ? n = ~n + 1 : t += 1, new f0(n, t);
  }
  /**
   * Convert to decimal string.
   */
  toString() {
    if (l0)
      return this.toBigInt().toString();
    if (this.isNegative()) {
      let t = this.negate();
      return "-" + ps(t.lo, t.hi);
    }
    return ps(this.lo, this.hi);
  }
  /**
   * Convert to native bigint.
   */
  toBigInt() {
    return So(l0), l0.V.setInt32(0, this.lo, !0), l0.V.setInt32(4, this.hi, !0), l0.V.getBigInt64(0, !0);
  }
}
f0.ZERO = new f0(0, 0);
const $r = {
  readUnknownField: !0,
  readerFactory: (e) => new Rl(e)
};
function Ml(e) {
  return e ? Object.assign(Object.assign({}, $r), e) : $r;
}
class Rl {
  constructor(t, n) {
    this.varint64 = _l, this.uint32 = Bl, this.buf = t, this.len = t.length, this.pos = 0, this.view = new DataView(t.buffer, t.byteOffset, t.byteLength), this.textDecoder = n ?? new TextDecoder("utf-8", {
      fatal: !0,
      ignoreBOM: !0
    });
  }
  /**
   * Reads a tag - field number and wire type.
   */
  tag() {
    let t = this.uint32(), n = t >>> 3, a = t & 7;
    if (n <= 0 || a < 0 || a > 5)
      throw new Error("illegal tag: field no " + n + " wire type " + a);
    return [n, a];
  }
  /**
   * Skip one element on the wire and return the skipped data.
   * Supports WireType.StartGroup since v2.0.0-alpha.23.
   */
  skip(t) {
    let n = this.pos;
    switch (t) {
      case C0.Varint:
        for (; this.buf[this.pos++] & 128; )
          ;
        break;
      case C0.Bit64:
        this.pos += 4;
      case C0.Bit32:
        this.pos += 4;
        break;
      case C0.LengthDelimited:
        let a = this.uint32();
        this.pos += a;
        break;
      case C0.StartGroup:
        let s;
        for (; (s = this.tag()[1]) !== C0.EndGroup; )
          this.skip(s);
        break;
      default:
        throw new Error("cant skip wire type " + t);
    }
    return this.assertBounds(), this.buf.subarray(n, this.pos);
  }
  /**
   * Throws error if position in byte array is out of range.
   */
  assertBounds() {
    if (this.pos > this.len)
      throw new RangeError("premature EOF");
  }
  /**
   * Read a `int32` field, a signed 32 bit varint.
   */
  int32() {
    return this.uint32() | 0;
  }
  /**
   * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
   */
  sint32() {
    let t = this.uint32();
    return t >>> 1 ^ -(t & 1);
  }
  /**
   * Read a `int64` field, a signed 64-bit varint.
   */
  int64() {
    return new f0(...this.varint64());
  }
  /**
   * Read a `uint64` field, an unsigned 64-bit varint.
   */
  uint64() {
    return new $0(...this.varint64());
  }
  /**
   * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64() {
    let [t, n] = this.varint64(), a = -(t & 1);
    return t = (t >>> 1 | (n & 1) << 31) ^ a, n = n >>> 1 ^ a, new f0(t, n);
  }
  /**
   * Read a `bool` field, a variant.
   */
  bool() {
    let [t, n] = this.varint64();
    return t !== 0 || n !== 0;
  }
  /**
   * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
   */
  fixed32() {
    return this.view.getUint32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
   */
  sfixed32() {
    return this.view.getInt32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
   */
  fixed64() {
    return new $0(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
   */
  sfixed64() {
    return new f0(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `float` field, 32-bit floating point number.
   */
  float() {
    return this.view.getFloat32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `double` field, a 64-bit floating point number.
   */
  double() {
    return this.view.getFloat64((this.pos += 8) - 8, !0);
  }
  /**
   * Read a `bytes` field, length-delimited arbitrary data.
   */
  bytes() {
    let t = this.uint32(), n = this.pos;
    return this.pos += t, this.assertBounds(), this.buf.subarray(n, n + t);
  }
  /**
   * Read a `string` field, length-delimited data converted to UTF-8 text.
   */
  string() {
    return this.textDecoder.decode(this.bytes());
  }
}
function s0(e, t) {
  if (!e)
    throw new Error(t);
}
const Dl = 34028234663852886e22, Ul = -34028234663852886e22, Pl = 4294967295, Vl = 2147483647, Fl = -2147483648;
function Xt(e) {
  if (typeof e != "number")
    throw new Error("invalid int 32: " + typeof e);
  if (!Number.isInteger(e) || e > Vl || e < Fl)
    throw new Error("invalid int 32: " + e);
}
function aa(e) {
  if (typeof e != "number")
    throw new Error("invalid uint 32: " + typeof e);
  if (!Number.isInteger(e) || e > Pl || e < 0)
    throw new Error("invalid uint 32: " + e);
}
function Fs(e) {
  if (typeof e != "number")
    throw new Error("invalid float 32: " + typeof e);
  if (Number.isFinite(e) && (e > Dl || e < Ul))
    throw new Error("invalid float 32: " + e);
}
const Lr = {
  writeUnknownFields: !0,
  writerFactory: () => new Ll()
};
function $l(e) {
  return e ? Object.assign(Object.assign({}, Lr), e) : Lr;
}
class Ll {
  constructor(t) {
    this.stack = [], this.textEncoder = t ?? new TextEncoder(), this.chunks = [], this.buf = [];
  }
  /**
   * Return all bytes written and reset this writer.
   */
  finish() {
    this.chunks.push(new Uint8Array(this.buf));
    let t = 0;
    for (let s = 0; s < this.chunks.length; s++)
      t += this.chunks[s].length;
    let n = new Uint8Array(t), a = 0;
    for (let s = 0; s < this.chunks.length; s++)
      n.set(this.chunks[s], a), a += this.chunks[s].length;
    return this.chunks = [], n;
  }
  /**
   * Start a new fork for length-delimited data like a message
   * or a packed repeated field.
   *
   * Must be joined later with `join()`.
   */
  fork() {
    return this.stack.push({ chunks: this.chunks, buf: this.buf }), this.chunks = [], this.buf = [], this;
  }
  /**
   * Join the last fork. Write its length and bytes, then
   * return to the previous state.
   */
  join() {
    let t = this.finish(), n = this.stack.pop();
    if (!n)
      throw new Error("invalid state, fork stack empty");
    return this.chunks = n.chunks, this.buf = n.buf, this.uint32(t.byteLength), this.raw(t);
  }
  /**
   * Writes a tag (field number and wire type).
   *
   * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
   *
   * Generated code should compute the tag ahead of time and call `uint32()`.
   */
  tag(t, n) {
    return this.uint32((t << 3 | n) >>> 0);
  }
  /**
   * Write a chunk of raw bytes.
   */
  raw(t) {
    return this.buf.length && (this.chunks.push(new Uint8Array(this.buf)), this.buf = []), this.chunks.push(t), this;
  }
  /**
   * Write a `uint32` value, an unsigned 32 bit varint.
   */
  uint32(t) {
    for (aa(t); t > 127; )
      this.buf.push(t & 127 | 128), t = t >>> 7;
    return this.buf.push(t), this;
  }
  /**
   * Write a `int32` value, a signed 32 bit varint.
   */
  int32(t) {
    return Xt(t), Fr(t, this.buf), this;
  }
  /**
   * Write a `bool` value, a variant.
   */
  bool(t) {
    return this.buf.push(t ? 1 : 0), this;
  }
  /**
   * Write a `bytes` value, length-delimited arbitrary data.
   */
  bytes(t) {
    return this.uint32(t.byteLength), this.raw(t);
  }
  /**
   * Write a `string` value, length-delimited data converted to UTF-8 text.
   */
  string(t) {
    let n = this.textEncoder.encode(t);
    return this.uint32(n.byteLength), this.raw(n);
  }
  /**
   * Write a `float` value, 32-bit floating point number.
   */
  float(t) {
    Fs(t);
    let n = new Uint8Array(4);
    return new DataView(n.buffer).setFloat32(0, t, !0), this.raw(n);
  }
  /**
   * Write a `double` value, a 64-bit floating point number.
   */
  double(t) {
    let n = new Uint8Array(8);
    return new DataView(n.buffer).setFloat64(0, t, !0), this.raw(n);
  }
  /**
   * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
   */
  fixed32(t) {
    aa(t);
    let n = new Uint8Array(4);
    return new DataView(n.buffer).setUint32(0, t, !0), this.raw(n);
  }
  /**
   * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
   */
  sfixed32(t) {
    Xt(t);
    let n = new Uint8Array(4);
    return new DataView(n.buffer).setInt32(0, t, !0), this.raw(n);
  }
  /**
   * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
   */
  sint32(t) {
    return Xt(t), t = (t << 1 ^ t >> 31) >>> 0, Fr(t, this.buf), this;
  }
  /**
   * Write a `fixed64` value, a signed, fixed-length 64-bit integer.
   */
  sfixed64(t) {
    let n = new Uint8Array(8), a = new DataView(n.buffer), s = f0.from(t);
    return a.setInt32(0, s.lo, !0), a.setInt32(4, s.hi, !0), this.raw(n);
  }
  /**
   * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
   */
  fixed64(t) {
    let n = new Uint8Array(8), a = new DataView(n.buffer), s = $0.from(t);
    return a.setInt32(0, s.lo, !0), a.setInt32(4, s.hi, !0), this.raw(n);
  }
  /**
   * Write a `int64` value, a signed 64-bit varint.
   */
  int64(t) {
    let n = f0.from(t);
    return Pa(n.lo, n.hi, this.buf), this;
  }
  /**
   * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64(t) {
    let n = f0.from(t), a = n.hi >> 31, s = n.lo << 1 ^ a, r = (n.hi << 1 | n.lo >>> 31) ^ a;
    return Pa(s, r, this.buf), this;
  }
  /**
   * Write a `uint64` value, an unsigned 64-bit varint.
   */
  uint64(t) {
    let n = $0.from(t);
    return Pa(n.lo, n.hi, this.buf), this;
  }
}
const zr = {
  emitDefaultValues: !1,
  enumAsInteger: !1,
  useProtoFieldName: !1,
  prettySpaces: 0
}, Gr = {
  ignoreUnknownFields: !1
};
function zl(e) {
  return e ? Object.assign(Object.assign({}, Gr), e) : Gr;
}
function Gl(e) {
  return e ? Object.assign(Object.assign({}, zr), e) : zr;
}
const Co = Symbol.for("protobuf-ts/message-type");
function Wr(e) {
  let t = !1;
  const n = [];
  for (let a = 0; a < e.length; a++) {
    let s = e.charAt(a);
    s == "_" ? t = !0 : /\d/.test(s) ? (n.push(s), t = !0) : t ? (n.push(s.toUpperCase()), t = !1) : a == 0 ? n.push(s.toLowerCase()) : n.push(s);
  }
  return n.join("");
}
var T;
(function(e) {
  e[e.DOUBLE = 1] = "DOUBLE", e[e.FLOAT = 2] = "FLOAT", e[e.INT64 = 3] = "INT64", e[e.UINT64 = 4] = "UINT64", e[e.INT32 = 5] = "INT32", e[e.FIXED64 = 6] = "FIXED64", e[e.FIXED32 = 7] = "FIXED32", e[e.BOOL = 8] = "BOOL", e[e.STRING = 9] = "STRING", e[e.BYTES = 12] = "BYTES", e[e.UINT32 = 13] = "UINT32", e[e.SFIXED32 = 15] = "SFIXED32", e[e.SFIXED64 = 16] = "SFIXED64", e[e.SINT32 = 17] = "SINT32", e[e.SINT64 = 18] = "SINT64";
})(T || (T = {}));
var ke;
(function(e) {
  e[e.BIGINT = 0] = "BIGINT", e[e.STRING = 1] = "STRING", e[e.NUMBER = 2] = "NUMBER";
})(ke || (ke = {}));
var sa;
(function(e) {
  e[e.NO = 0] = "NO", e[e.PACKED = 1] = "PACKED", e[e.UNPACKED = 2] = "UNPACKED";
})(sa || (sa = {}));
function Wl(e) {
  var t, n, a, s;
  return e.localName = (t = e.localName) !== null && t !== void 0 ? t : Wr(e.name), e.jsonName = (n = e.jsonName) !== null && n !== void 0 ? n : Wr(e.name), e.repeat = (a = e.repeat) !== null && a !== void 0 ? a : sa.NO, e.opt = (s = e.opt) !== null && s !== void 0 ? s : e.repeat || e.oneof ? !1 : e.kind == "message", e;
}
function Ql(e) {
  if (typeof e != "object" || e === null || !e.hasOwnProperty("oneofKind"))
    return !1;
  switch (typeof e.oneofKind) {
    case "string":
      return e[e.oneofKind] === void 0 ? !1 : Object.keys(e).length == 2;
    case "undefined":
      return Object.keys(e).length == 1;
    default:
      return !1;
  }
}
class Jl {
  constructor(t) {
    var n;
    this.fields = (n = t.fields) !== null && n !== void 0 ? n : [];
  }
  prepare() {
    if (this.data)
      return;
    const t = [], n = [], a = [];
    for (let s of this.fields)
      if (s.oneof)
        a.includes(s.oneof) || (a.push(s.oneof), t.push(s.oneof), n.push(s.oneof));
      else
        switch (n.push(s.localName), s.kind) {
          case "scalar":
          case "enum":
            (!s.opt || s.repeat) && t.push(s.localName);
            break;
          case "message":
            s.repeat && t.push(s.localName);
            break;
          case "map":
            t.push(s.localName);
            break;
        }
    this.data = { req: t, known: n, oneofs: Object.values(a) };
  }
  /**
   * Is the argument a valid message as specified by the
   * reflection information?
   *
   * Checks all field types recursively. The `depth`
   * specifies how deep into the structure the check will be.
   *
   * With a depth of 0, only the presence of fields
   * is checked.
   *
   * With a depth of 1 or more, the field types are checked.
   *
   * With a depth of 2 or more, the members of map, repeated
   * and message fields are checked.
   *
   * Message fields will be checked recursively with depth - 1.
   *
   * The number of map entries / repeated values being checked
   * is < depth.
   */
  is(t, n, a = !1) {
    if (n < 0)
      return !0;
    if (t == null || typeof t != "object")
      return !1;
    this.prepare();
    let s = Object.keys(t), r = this.data;
    if (s.length < r.req.length || r.req.some((i) => !s.includes(i)) || !a && s.some((i) => !r.known.includes(i)))
      return !1;
    if (n < 1)
      return !0;
    for (const i of r.oneofs) {
      const c = t[i];
      if (!Ql(c))
        return !1;
      if (c.oneofKind === void 0)
        continue;
      const o = this.fields.find((d) => d.localName === c.oneofKind);
      if (!o || !this.field(c[c.oneofKind], o, a, n))
        return !1;
    }
    for (const i of this.fields)
      if (i.oneof === void 0 && !this.field(t[i.localName], i, a, n))
        return !1;
    return !0;
  }
  field(t, n, a, s) {
    let r = n.repeat;
    switch (n.kind) {
      case "scalar":
        return t === void 0 ? n.opt : r ? this.scalars(t, n.T, s, n.L) : this.scalar(t, n.T, n.L);
      case "enum":
        return t === void 0 ? n.opt : r ? this.scalars(t, T.INT32, s) : this.scalar(t, T.INT32);
      case "message":
        return t === void 0 ? !0 : r ? this.messages(t, n.T(), a, s) : this.message(t, n.T(), a, s);
      case "map":
        if (typeof t != "object" || t === null)
          return !1;
        if (s < 2)
          return !0;
        if (!this.mapKeys(t, n.K, s))
          return !1;
        switch (n.V.kind) {
          case "scalar":
            return this.scalars(Object.values(t), n.V.T, s, n.V.L);
          case "enum":
            return this.scalars(Object.values(t), T.INT32, s);
          case "message":
            return this.messages(Object.values(t), n.V.T(), a, s);
        }
        break;
    }
    return !0;
  }
  message(t, n, a, s) {
    return a ? n.isAssignable(t, s) : n.is(t, s);
  }
  messages(t, n, a, s) {
    if (!Array.isArray(t))
      return !1;
    if (s < 2)
      return !0;
    if (a) {
      for (let r = 0; r < t.length && r < s; r++)
        if (!n.isAssignable(t[r], s - 1))
          return !1;
    } else
      for (let r = 0; r < t.length && r < s; r++)
        if (!n.is(t[r], s - 1))
          return !1;
    return !0;
  }
  scalar(t, n, a) {
    let s = typeof t;
    switch (n) {
      case T.UINT64:
      case T.FIXED64:
      case T.INT64:
      case T.SFIXED64:
      case T.SINT64:
        switch (a) {
          case ke.BIGINT:
            return s == "bigint";
          case ke.NUMBER:
            return s == "number" && !isNaN(t);
          default:
            return s == "string";
        }
      case T.BOOL:
        return s == "boolean";
      case T.STRING:
        return s == "string";
      case T.BYTES:
        return t instanceof Uint8Array;
      case T.DOUBLE:
      case T.FLOAT:
        return s == "number" && !isNaN(t);
      default:
        return s == "number" && Number.isInteger(t);
    }
  }
  scalars(t, n, a, s) {
    if (!Array.isArray(t))
      return !1;
    if (a < 2)
      return !0;
    if (Array.isArray(t)) {
      for (let r = 0; r < t.length && r < a; r++)
        if (!this.scalar(t[r], n, s))
          return !1;
    }
    return !0;
  }
  mapKeys(t, n, a) {
    let s = Object.keys(t);
    switch (n) {
      case T.INT32:
      case T.FIXED32:
      case T.SFIXED32:
      case T.SINT32:
      case T.UINT32:
        return this.scalars(s.slice(0, a).map((r) => parseInt(r)), n, a);
      case T.BOOL:
        return this.scalars(s.slice(0, a).map((r) => r == "true" ? !0 : r == "false" ? !1 : r), n, a);
      default:
        return this.scalars(s, n, a, ke.STRING);
    }
  }
}
function ge(e, t) {
  switch (t) {
    case ke.BIGINT:
      return e.toBigInt();
    case ke.NUMBER:
      return e.toNumber();
    default:
      return e.toString();
  }
}
class Yl {
  constructor(t) {
    this.info = t;
  }
  prepare() {
    var t;
    if (this.fMap === void 0) {
      this.fMap = {};
      const n = (t = this.info.fields) !== null && t !== void 0 ? t : [];
      for (const a of n)
        this.fMap[a.name] = a, this.fMap[a.jsonName] = a, this.fMap[a.localName] = a;
    }
  }
  // Cannot parse JSON <type of jsonValue> for <type name>#<fieldName>.
  assert(t, n, a) {
    if (!t) {
      let s = St(a);
      throw (s == "number" || s == "boolean") && (s = a.toString()), new Error(`Cannot parse JSON ${s} for ${this.info.typeName}#${n}`);
    }
  }
  /**
   * Reads a message from canonical JSON format into the target message.
   *
   * Repeated fields are appended. Map entries are added, overwriting
   * existing keys.
   *
   * If a message field is already present, it will be merged with the
   * new data.
   */
  read(t, n, a) {
    this.prepare();
    const s = [];
    for (const [r, i] of Object.entries(t)) {
      const c = this.fMap[r];
      if (!c) {
        if (!a.ignoreUnknownFields)
          throw new Error(`Found unknown field while reading ${this.info.typeName} from JSON format. JSON key: ${r}`);
        continue;
      }
      const o = c.localName;
      let d;
      if (c.oneof) {
        if (i === null && (c.kind !== "enum" || c.T()[0] !== "google.protobuf.NullValue"))
          continue;
        if (s.includes(c.oneof))
          throw new Error(`Multiple members of the oneof group "${c.oneof}" of ${this.info.typeName} are present in JSON.`);
        s.push(c.oneof), d = n[c.oneof] = {
          oneofKind: o
        };
      } else
        d = n;
      if (c.kind == "map") {
        if (i === null)
          continue;
        this.assert(Oo(i), c.name, i);
        const u = d[o];
        for (const [l, b] of Object.entries(i)) {
          this.assert(b !== null, c.name + " map value", null);
          let p;
          switch (c.V.kind) {
            case "message":
              p = c.V.T().internalJsonRead(b, a);
              break;
            case "enum":
              if (p = this.enum(c.V.T(), b, c.name, a.ignoreUnknownFields), p === !1)
                continue;
              break;
            case "scalar":
              p = this.scalar(b, c.V.T, c.V.L, c.name);
              break;
          }
          this.assert(p !== void 0, c.name + " map value", b);
          let m = l;
          c.K == T.BOOL && (m = m == "true" ? !0 : m == "false" ? !1 : m), m = this.scalar(m, c.K, ke.STRING, c.name).toString(), u[m] = p;
        }
      } else if (c.repeat) {
        if (i === null)
          continue;
        this.assert(Array.isArray(i), c.name, i);
        const u = d[o];
        for (const l of i) {
          this.assert(l !== null, c.name, null);
          let b;
          switch (c.kind) {
            case "message":
              b = c.T().internalJsonRead(l, a);
              break;
            case "enum":
              if (b = this.enum(c.T(), l, c.name, a.ignoreUnknownFields), b === !1)
                continue;
              break;
            case "scalar":
              b = this.scalar(l, c.T, c.L, c.name);
              break;
          }
          this.assert(b !== void 0, c.name, i), u.push(b);
        }
      } else
        switch (c.kind) {
          case "message":
            if (i === null && c.T().typeName != "google.protobuf.Value") {
              this.assert(c.oneof === void 0, c.name + " (oneof member)", null);
              continue;
            }
            d[o] = c.T().internalJsonRead(i, a, d[o]);
            break;
          case "enum":
            if (i === null)
              continue;
            let u = this.enum(c.T(), i, c.name, a.ignoreUnknownFields);
            if (u === !1)
              continue;
            d[o] = u;
            break;
          case "scalar":
            if (i === null)
              continue;
            d[o] = this.scalar(i, c.T, c.L, c.name);
            break;
        }
    }
  }
  /**
   * Returns `false` for unrecognized string representations.
   *
   * google.protobuf.NullValue accepts only JSON `null` (or the old `"NULL_VALUE"`).
   */
  enum(t, n, a, s) {
    if (t[0] == "google.protobuf.NullValue" && s0(n === null || n === "NULL_VALUE", `Unable to parse field ${this.info.typeName}#${a}, enum ${t[0]} only accepts null.`), n === null)
      return 0;
    switch (typeof n) {
      case "number":
        return s0(Number.isInteger(n), `Unable to parse field ${this.info.typeName}#${a}, enum can only be integral number, got ${n}.`), n;
      case "string":
        let r = n;
        t[2] && n.substring(0, t[2].length) === t[2] && (r = n.substring(t[2].length));
        let i = t[1][r];
        return typeof i > "u" && s ? !1 : (s0(typeof i == "number", `Unable to parse field ${this.info.typeName}#${a}, enum ${t[0]} has no value for "${n}".`), i);
    }
    s0(!1, `Unable to parse field ${this.info.typeName}#${a}, cannot parse enum value from ${typeof n}".`);
  }
  scalar(t, n, a, s) {
    let r;
    try {
      switch (n) {
        case T.DOUBLE:
        case T.FLOAT:
          if (t === null)
            return 0;
          if (t === "NaN")
            return Number.NaN;
          if (t === "Infinity")
            return Number.POSITIVE_INFINITY;
          if (t === "-Infinity")
            return Number.NEGATIVE_INFINITY;
          if (t === "") {
            r = "empty string";
            break;
          }
          if (typeof t == "string" && t.trim().length !== t.length) {
            r = "extra whitespace";
            break;
          }
          if (typeof t != "string" && typeof t != "number")
            break;
          let i = Number(t);
          if (Number.isNaN(i)) {
            r = "not a number";
            break;
          }
          if (!Number.isFinite(i)) {
            r = "too large or small";
            break;
          }
          return n == T.FLOAT && Fs(i), i;
        case T.INT32:
        case T.FIXED32:
        case T.SFIXED32:
        case T.SINT32:
        case T.UINT32:
          if (t === null)
            return 0;
          let c;
          if (typeof t == "number" ? c = t : t === "" ? r = "empty string" : typeof t == "string" && (t.trim().length !== t.length ? r = "extra whitespace" : c = Number(t)), c === void 0)
            break;
          return n == T.UINT32 ? aa(c) : Xt(c), c;
        case T.INT64:
        case T.SFIXED64:
        case T.SINT64:
          if (t === null)
            return ge(f0.ZERO, a);
          if (typeof t != "number" && typeof t != "string")
            break;
          return ge(f0.from(t), a);
        case T.FIXED64:
        case T.UINT64:
          if (t === null)
            return ge($0.ZERO, a);
          if (typeof t != "number" && typeof t != "string")
            break;
          return ge($0.from(t), a);
        case T.BOOL:
          if (t === null)
            return !1;
          if (typeof t != "boolean")
            break;
          return t;
        case T.STRING:
          if (t === null)
            return "";
          if (typeof t != "string") {
            r = "extra whitespace";
            break;
          }
          try {
            encodeURIComponent(t);
          } catch (o) {
            o = "invalid UTF8";
            break;
          }
          return t;
        case T.BYTES:
          if (t === null || t === "")
            return new Uint8Array(0);
          if (typeof t != "string")
            break;
          return Cl(t);
      }
    } catch (i) {
      r = i.message;
    }
    this.assert(!1, s + (r ? " - " + r : ""), t);
  }
}
class Zl {
  constructor(t) {
    var n;
    this.fields = (n = t.fields) !== null && n !== void 0 ? n : [];
  }
  /**
   * Converts the message to a JSON object, based on the field descriptors.
   */
  write(t, n) {
    const a = {}, s = t;
    for (const r of this.fields) {
      if (!r.oneof) {
        let d = this.field(r, s[r.localName], n);
        d !== void 0 && (a[n.useProtoFieldName ? r.name : r.jsonName] = d);
        continue;
      }
      const i = s[r.oneof];
      if (i.oneofKind !== r.localName)
        continue;
      const c = r.kind == "scalar" || r.kind == "enum" ? Object.assign(Object.assign({}, n), { emitDefaultValues: !0 }) : n;
      let o = this.field(r, i[r.localName], c);
      s0(o !== void 0), a[n.useProtoFieldName ? r.name : r.jsonName] = o;
    }
    return a;
  }
  field(t, n, a) {
    let s;
    if (t.kind == "map") {
      s0(typeof n == "object" && n !== null);
      const r = {};
      switch (t.V.kind) {
        case "scalar":
          for (const [o, d] of Object.entries(n)) {
            const u = this.scalar(t.V.T, d, t.name, !1, !0);
            s0(u !== void 0), r[o.toString()] = u;
          }
          break;
        case "message":
          const i = t.V.T();
          for (const [o, d] of Object.entries(n)) {
            const u = this.message(i, d, t.name, a);
            s0(u !== void 0), r[o.toString()] = u;
          }
          break;
        case "enum":
          const c = t.V.T();
          for (const [o, d] of Object.entries(n)) {
            s0(d === void 0 || typeof d == "number");
            const u = this.enum(c, d, t.name, !1, !0, a.enumAsInteger);
            s0(u !== void 0), r[o.toString()] = u;
          }
          break;
      }
      (a.emitDefaultValues || Object.keys(r).length > 0) && (s = r);
    } else if (t.repeat) {
      s0(Array.isArray(n));
      const r = [];
      switch (t.kind) {
        case "scalar":
          for (let o = 0; o < n.length; o++) {
            const d = this.scalar(t.T, n[o], t.name, t.opt, !0);
            s0(d !== void 0), r.push(d);
          }
          break;
        case "enum":
          const i = t.T();
          for (let o = 0; o < n.length; o++) {
            s0(n[o] === void 0 || typeof n[o] == "number");
            const d = this.enum(i, n[o], t.name, t.opt, !0, a.enumAsInteger);
            s0(d !== void 0), r.push(d);
          }
          break;
        case "message":
          const c = t.T();
          for (let o = 0; o < n.length; o++) {
            const d = this.message(c, n[o], t.name, a);
            s0(d !== void 0), r.push(d);
          }
          break;
      }
      (a.emitDefaultValues || r.length > 0 || a.emitDefaultValues) && (s = r);
    } else
      switch (t.kind) {
        case "scalar":
          s = this.scalar(t.T, n, t.name, t.opt, a.emitDefaultValues);
          break;
        case "enum":
          s = this.enum(t.T(), n, t.name, t.opt, a.emitDefaultValues, a.enumAsInteger);
          break;
        case "message":
          s = this.message(t.T(), n, t.name, a);
          break;
      }
    return s;
  }
  /**
   * Returns `null` as the default for google.protobuf.NullValue.
   */
  enum(t, n, a, s, r, i) {
    if (t[0] == "google.protobuf.NullValue")
      return !r && !s ? void 0 : null;
    if (n === void 0) {
      s0(s);
      return;
    }
    if (!(n === 0 && !r && !s))
      return s0(typeof n == "number"), s0(Number.isInteger(n)), i || !t[1].hasOwnProperty(n) ? n : t[2] ? t[2] + t[1][n] : t[1][n];
  }
  message(t, n, a, s) {
    return n === void 0 ? s.emitDefaultValues ? null : void 0 : t.internalJsonWrite(n, s);
  }
  scalar(t, n, a, s, r) {
    if (n === void 0) {
      s0(s);
      return;
    }
    const i = r || s;
    switch (t) {
      case T.INT32:
      case T.SFIXED32:
      case T.SINT32:
        return n === 0 ? i ? 0 : void 0 : (Xt(n), n);
      case T.FIXED32:
      case T.UINT32:
        return n === 0 ? i ? 0 : void 0 : (aa(n), n);
      case T.FLOAT:
        Fs(n);
      case T.DOUBLE:
        return n === 0 ? i ? 0 : void 0 : (s0(typeof n == "number"), Number.isNaN(n) ? "NaN" : n === Number.POSITIVE_INFINITY ? "Infinity" : n === Number.NEGATIVE_INFINITY ? "-Infinity" : n);
      case T.STRING:
        return n === "" ? i ? "" : void 0 : (s0(typeof n == "string"), n);
      case T.BOOL:
        return n === !1 ? i ? !1 : void 0 : (s0(typeof n == "boolean"), n);
      case T.UINT64:
      case T.FIXED64:
        s0(typeof n == "number" || typeof n == "string" || typeof n == "bigint");
        let c = $0.from(n);
        return c.isZero() && !i ? void 0 : c.toString();
      case T.INT64:
      case T.SFIXED64:
      case T.SINT64:
        s0(typeof n == "number" || typeof n == "string" || typeof n == "bigint");
        let o = f0.from(n);
        return o.isZero() && !i ? void 0 : o.toString();
      case T.BYTES:
        return s0(n instanceof Uint8Array), n.byteLength ? xl(n) : i ? "" : void 0;
    }
  }
}
function ms(e, t = ke.STRING) {
  switch (e) {
    case T.BOOL:
      return !1;
    case T.UINT64:
    case T.FIXED64:
      return ge($0.ZERO, t);
    case T.INT64:
    case T.SFIXED64:
    case T.SINT64:
      return ge(f0.ZERO, t);
    case T.DOUBLE:
    case T.FLOAT:
      return 0;
    case T.BYTES:
      return new Uint8Array(0);
    case T.STRING:
      return "";
    default:
      return 0;
  }
}
class Hl {
  constructor(t) {
    this.info = t;
  }
  prepare() {
    var t;
    if (!this.fieldNoToField) {
      const n = (t = this.info.fields) !== null && t !== void 0 ? t : [];
      this.fieldNoToField = new Map(n.map((a) => [a.no, a]));
    }
  }
  /**
   * Reads a message from binary format into the target message.
   *
   * Repeated fields are appended. Map entries are added, overwriting
   * existing keys.
   *
   * If a message field is already present, it will be merged with the
   * new data.
   */
  read(t, n, a, s) {
    this.prepare();
    const r = s === void 0 ? t.len : t.pos + s;
    for (; t.pos < r; ) {
      const [i, c] = t.tag(), o = this.fieldNoToField.get(i);
      if (!o) {
        let b = a.readUnknownField;
        if (b == "throw")
          throw new Error(`Unknown field ${i} (wire type ${c}) for ${this.info.typeName}`);
        let p = t.skip(c);
        b !== !1 && (b === !0 ? ta.onRead : b)(this.info.typeName, n, i, c, p);
        continue;
      }
      let d = n, u = o.repeat, l = o.localName;
      switch (o.oneof && (d = d[o.oneof], d.oneofKind !== l && (d = n[o.oneof] = {
        oneofKind: l
      })), o.kind) {
        case "scalar":
        case "enum":
          let b = o.kind == "enum" ? T.INT32 : o.T, p = o.kind == "scalar" ? o.L : void 0;
          if (u) {
            let y = d[l];
            if (c == C0.LengthDelimited && b != T.STRING && b != T.BYTES) {
              let w = t.uint32() + t.pos;
              for (; t.pos < w; )
                y.push(this.scalar(t, b, p));
            } else
              y.push(this.scalar(t, b, p));
          } else
            d[l] = this.scalar(t, b, p);
          break;
        case "message":
          if (u) {
            let y = d[l], w = o.T().internalBinaryRead(t, t.uint32(), a);
            y.push(w);
          } else
            d[l] = o.T().internalBinaryRead(t, t.uint32(), a, d[l]);
          break;
        case "map":
          let [m, h] = this.mapEntry(o, t, a);
          d[l][m] = h;
          break;
      }
    }
  }
  /**
   * Read a map field, expecting key field = 1, value field = 2
   */
  mapEntry(t, n, a) {
    let s = n.uint32(), r = n.pos + s, i, c;
    for (; n.pos < r; ) {
      let [o, d] = n.tag();
      switch (o) {
        case 1:
          t.K == T.BOOL ? i = n.bool().toString() : i = this.scalar(n, t.K, ke.STRING);
          break;
        case 2:
          switch (t.V.kind) {
            case "scalar":
              c = this.scalar(n, t.V.T, t.V.L);
              break;
            case "enum":
              c = n.int32();
              break;
            case "message":
              c = t.V.T().internalBinaryRead(n, n.uint32(), a);
              break;
          }
          break;
        default:
          throw new Error(`Unknown field ${o} (wire type ${d}) in map entry for ${this.info.typeName}#${t.name}`);
      }
    }
    if (i === void 0) {
      let o = ms(t.K);
      i = t.K == T.BOOL ? o.toString() : o;
    }
    if (c === void 0)
      switch (t.V.kind) {
        case "scalar":
          c = ms(t.V.T, t.V.L);
          break;
        case "enum":
          c = 0;
          break;
        case "message":
          c = t.V.T().create();
          break;
      }
    return [i, c];
  }
  scalar(t, n, a) {
    switch (n) {
      case T.INT32:
        return t.int32();
      case T.STRING:
        return t.string();
      case T.BOOL:
        return t.bool();
      case T.DOUBLE:
        return t.double();
      case T.FLOAT:
        return t.float();
      case T.INT64:
        return ge(t.int64(), a);
      case T.UINT64:
        return ge(t.uint64(), a);
      case T.FIXED64:
        return ge(t.fixed64(), a);
      case T.FIXED32:
        return t.fixed32();
      case T.BYTES:
        return t.bytes();
      case T.UINT32:
        return t.uint32();
      case T.SFIXED32:
        return t.sfixed32();
      case T.SFIXED64:
        return ge(t.sfixed64(), a);
      case T.SINT32:
        return t.sint32();
      case T.SINT64:
        return ge(t.sint64(), a);
    }
  }
}
class ql {
  constructor(t) {
    this.info = t;
  }
  prepare() {
    if (!this.fields) {
      const t = this.info.fields ? this.info.fields.concat() : [];
      this.fields = t.sort((n, a) => n.no - a.no);
    }
  }
  /**
   * Writes the message to binary format.
   */
  write(t, n, a) {
    this.prepare();
    for (const r of this.fields) {
      let i, c, o = r.repeat, d = r.localName;
      if (r.oneof) {
        const u = t[r.oneof];
        if (u.oneofKind !== d)
          continue;
        i = u[d], c = !0;
      } else
        i = t[d], c = !1;
      switch (r.kind) {
        case "scalar":
        case "enum":
          let u = r.kind == "enum" ? T.INT32 : r.T;
          if (o)
            if (s0(Array.isArray(i)), o == sa.PACKED)
              this.packed(n, u, r.no, i);
            else
              for (const l of i)
                this.scalar(n, u, r.no, l, !0);
          else i === void 0 ? s0(r.opt) : this.scalar(n, u, r.no, i, c || r.opt);
          break;
        case "message":
          if (o) {
            s0(Array.isArray(i));
            for (const l of i)
              this.message(n, a, r.T(), r.no, l);
          } else
            this.message(n, a, r.T(), r.no, i);
          break;
        case "map":
          s0(typeof i == "object" && i !== null);
          for (const [l, b] of Object.entries(i))
            this.mapEntry(n, a, r, l, b);
          break;
      }
    }
    let s = a.writeUnknownFields;
    s !== !1 && (s === !0 ? ta.onWrite : s)(this.info.typeName, t, n);
  }
  mapEntry(t, n, a, s, r) {
    t.tag(a.no, C0.LengthDelimited), t.fork();
    let i = s;
    switch (a.K) {
      case T.INT32:
      case T.FIXED32:
      case T.UINT32:
      case T.SFIXED32:
      case T.SINT32:
        i = Number.parseInt(s);
        break;
      case T.BOOL:
        s0(s == "true" || s == "false"), i = s == "true";
        break;
    }
    switch (this.scalar(t, a.K, 1, i, !0), a.V.kind) {
      case "scalar":
        this.scalar(t, a.V.T, 2, r, !0);
        break;
      case "enum":
        this.scalar(t, T.INT32, 2, r, !0);
        break;
      case "message":
        this.message(t, n, a.V.T(), 2, r);
        break;
    }
    t.join();
  }
  message(t, n, a, s, r) {
    r !== void 0 && (a.internalBinaryWrite(r, t.tag(s, C0.LengthDelimited).fork(), n), t.join());
  }
  /**
   * Write a single scalar value.
   */
  scalar(t, n, a, s, r) {
    let [i, c, o] = this.scalarInfo(n, s);
    (!o || r) && (t.tag(a, i), t[c](s));
  }
  /**
   * Write an array of scalar values in packed format.
   */
  packed(t, n, a, s) {
    if (!s.length)
      return;
    s0(n !== T.BYTES && n !== T.STRING), t.tag(a, C0.LengthDelimited), t.fork();
    let [, r] = this.scalarInfo(n);
    for (let i = 0; i < s.length; i++)
      t[r](s[i]);
    t.join();
  }
  /**
   * Get information for writing a scalar value.
   *
   * Returns tuple:
   * [0]: appropriate WireType
   * [1]: name of the appropriate method of IBinaryWriter
   * [2]: whether the given value is a default value
   *
   * If argument `value` is omitted, [2] is always false.
   */
  scalarInfo(t, n) {
    let a = C0.Varint, s, r = n === void 0, i = n === 0;
    switch (t) {
      case T.INT32:
        s = "int32";
        break;
      case T.STRING:
        i = r || !n.length, a = C0.LengthDelimited, s = "string";
        break;
      case T.BOOL:
        i = n === !1, s = "bool";
        break;
      case T.UINT32:
        s = "uint32";
        break;
      case T.DOUBLE:
        a = C0.Bit64, s = "double";
        break;
      case T.FLOAT:
        a = C0.Bit32, s = "float";
        break;
      case T.INT64:
        i = r || f0.from(n).isZero(), s = "int64";
        break;
      case T.UINT64:
        i = r || $0.from(n).isZero(), s = "uint64";
        break;
      case T.FIXED64:
        i = r || $0.from(n).isZero(), a = C0.Bit64, s = "fixed64";
        break;
      case T.BYTES:
        i = r || !n.byteLength, a = C0.LengthDelimited, s = "bytes";
        break;
      case T.FIXED32:
        a = C0.Bit32, s = "fixed32";
        break;
      case T.SFIXED32:
        a = C0.Bit32, s = "sfixed32";
        break;
      case T.SFIXED64:
        i = r || f0.from(n).isZero(), a = C0.Bit64, s = "sfixed64";
        break;
      case T.SINT32:
        s = "sint32";
        break;
      case T.SINT64:
        i = r || f0.from(n).isZero(), s = "sint64";
        break;
    }
    return [a, s, r || i];
  }
}
function Xl(e) {
  const t = e.messagePrototype ? Object.create(e.messagePrototype) : Object.defineProperty({}, Co, { value: e });
  for (let n of e.fields) {
    let a = n.localName;
    if (!n.opt)
      if (n.oneof)
        t[n.oneof] = { oneofKind: void 0 };
      else if (n.repeat)
        t[a] = [];
      else
        switch (n.kind) {
          case "scalar":
            t[a] = ms(n.T, n.L);
            break;
          case "enum":
            t[a] = 0;
            break;
          case "map":
            t[a] = {};
            break;
        }
  }
  return t;
}
function Va(e, t, n) {
  let a, s = n, r;
  for (let i of e.fields) {
    let c = i.localName;
    if (i.oneof) {
      const o = s[i.oneof];
      if ((o == null ? void 0 : o.oneofKind) == null)
        continue;
      if (a = o[c], r = t[i.oneof], r.oneofKind = o.oneofKind, a == null) {
        delete r[c];
        continue;
      }
    } else if (a = s[c], r = t, a == null)
      continue;
    switch (i.repeat && (r[c].length = a.length), i.kind) {
      case "scalar":
      case "enum":
        if (i.repeat)
          for (let d = 0; d < a.length; d++)
            r[c][d] = a[d];
        else
          r[c] = a;
        break;
      case "message":
        let o = i.T();
        if (i.repeat)
          for (let d = 0; d < a.length; d++)
            r[c][d] = o.create(a[d]);
        else r[c] === void 0 ? r[c] = o.create(a) : o.mergePartial(r[c], a);
        break;
      case "map":
        switch (i.V.kind) {
          case "scalar":
          case "enum":
            Object.assign(r[c], a);
            break;
          case "message":
            let d = i.V.T();
            for (let u of Object.keys(a))
              r[c][u] = d.create(a[u]);
            break;
        }
        break;
    }
  }
}
function Kl(e, t, n) {
  if (t === n)
    return !0;
  if (!t || !n)
    return !1;
  for (let a of e.fields) {
    let s = a.localName, r = a.oneof ? t[a.oneof][s] : t[s], i = a.oneof ? n[a.oneof][s] : n[s];
    switch (a.kind) {
      case "enum":
      case "scalar":
        let c = a.kind == "enum" ? T.INT32 : a.T;
        if (!(a.repeat ? Qr(c, r, i) : xo(c, r, i)))
          return !1;
        break;
      case "map":
        if (!(a.V.kind == "message" ? Jr(a.V.T(), kn(r), kn(i)) : Qr(a.V.kind == "enum" ? T.INT32 : a.V.T, kn(r), kn(i))))
          return !1;
        break;
      case "message":
        let o = a.T();
        if (!(a.repeat ? Jr(o, r, i) : o.equals(r, i)))
          return !1;
        break;
    }
  }
  return !0;
}
const kn = Object.values;
function xo(e, t, n) {
  if (t === n)
    return !0;
  if (e !== T.BYTES)
    return !1;
  let a = t, s = n;
  if (a.length !== s.length)
    return !1;
  for (let r = 0; r < a.length; r++)
    if (a[r] != s[r])
      return !1;
  return !0;
}
function Qr(e, t, n) {
  if (t.length !== n.length)
    return !1;
  for (let a = 0; a < t.length; a++)
    if (!xo(e, t[a], n[a]))
      return !1;
  return !0;
}
function Jr(e, t, n) {
  if (t.length !== n.length)
    return !1;
  for (let a = 0; a < t.length; a++)
    if (!e.equals(t[a], n[a]))
      return !1;
  return !0;
}
const _o = Object.getOwnPropertyDescriptors(Object.getPrototypeOf({})), eb = _o[Co] = {};
class N {
  constructor(t, n, a) {
    this.defaultCheckDepth = 16, this.typeName = t, this.fields = n.map(Wl), this.options = a ?? {}, eb.value = this, this.messagePrototype = Object.create(null, _o), this.refTypeCheck = new Jl(this), this.refJsonReader = new Yl(this), this.refJsonWriter = new Zl(this), this.refBinReader = new Hl(this), this.refBinWriter = new ql(this);
  }
  create(t) {
    let n = Xl(this);
    return t !== void 0 && Va(this, n, t), n;
  }
  /**
   * Clone the message.
   *
   * Unknown fields are discarded.
   */
  clone(t) {
    let n = this.create();
    return Va(this, n, t), n;
  }
  /**
   * Determines whether two message of the same type have the same field values.
   * Checks for deep equality, traversing repeated fields, oneof groups, maps
   * and messages recursively.
   * Will also return true if both messages are `undefined`.
   */
  equals(t, n) {
    return Kl(this, t, n);
  }
  /**
   * Is the given value assignable to our message type
   * and contains no [excess properties](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks)?
   */
  is(t, n = this.defaultCheckDepth) {
    return this.refTypeCheck.is(t, n, !1);
  }
  /**
   * Is the given value assignable to our message type,
   * regardless of [excess properties](https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks)?
   */
  isAssignable(t, n = this.defaultCheckDepth) {
    return this.refTypeCheck.is(t, n, !0);
  }
  /**
   * Copy partial data into the target message.
   */
  mergePartial(t, n) {
    Va(this, t, n);
  }
  /**
   * Create a new message from binary format.
   */
  fromBinary(t, n) {
    let a = Ml(n);
    return this.internalBinaryRead(a.readerFactory(t), t.byteLength, a);
  }
  /**
   * Read a new message from a JSON value.
   */
  fromJson(t, n) {
    return this.internalJsonRead(t, zl(n));
  }
  /**
   * Read a new message from a JSON string.
   * This is equivalent to `T.fromJson(JSON.parse(json))`.
   */
  fromJsonString(t, n) {
    let a = JSON.parse(t);
    return this.fromJson(a, n);
  }
  /**
   * Write the message to canonical JSON value.
   */
  toJson(t, n) {
    return this.internalJsonWrite(t, Gl(n));
  }
  /**
   * Convert the message to canonical JSON string.
   * This is equivalent to `JSON.stringify(T.toJson(t))`
   */
  toJsonString(t, n) {
    var a;
    let s = this.toJson(t, n);
    return JSON.stringify(s, null, (a = n == null ? void 0 : n.prettySpaces) !== null && a !== void 0 ? a : 0);
  }
  /**
   * Write the message to binary format.
   */
  toBinary(t, n) {
    let a = $l(n);
    return this.internalBinaryWrite(t, a.writerFactory(), a).finish();
  }
  /**
   * This is an internal method. If you just want to read a message from
   * JSON, use `fromJson()` or `fromJsonString()`.
   *
   * Reads JSON value and merges the fields into the target
   * according to protobuf rules. If the target is omitted,
   * a new instance is created first.
   */
  internalJsonRead(t, n, a) {
    if (t !== null && typeof t == "object" && !Array.isArray(t)) {
      let s = a ?? this.create();
      return this.refJsonReader.read(t, s, n), s;
    }
    throw new Error(`Unable to parse message ${this.typeName} from JSON ${St(t)}.`);
  }
  /**
   * This is an internal method. If you just want to write a message
   * to JSON, use `toJson()` or `toJsonString().
   *
   * Writes JSON value and returns it.
   */
  internalJsonWrite(t, n) {
    return this.refJsonWriter.write(t, n);
  }
  /**
   * This is an internal method. If you just want to write a message
   * in binary format, use `toBinary()`.
   *
   * Serializes the message in binary format and appends it to the given
   * writer. Returns passed writer.
   */
  internalBinaryWrite(t, n, a) {
    return this.refBinWriter.write(t, n, a), n;
  }
  /**
   * This is an internal method. If you just want to read a message from
   * binary data, use `fromBinary()`.
   *
   * Reads data from binary format and merges the fields into
   * the target according to protobuf rules. If the target is
   * omitted, a new instance is created first.
   */
  internalBinaryRead(t, n, a, s) {
    let r = s ?? this.create();
    return this.refBinReader.read(t, r, a, n), r;
  }
}
var tb = class extends N {
  constructor() {
    super("google.protobuf.Duration", [{
      no: 1,
      name: "seconds",
      kind: "scalar",
      T: 3,
      L: 0
    }, {
      no: 2,
      name: "nanos",
      kind: "scalar",
      T: 5
    }]);
  }
  /**
  * Encode `Duration` to JSON string like "3.000001s".
  */
  internalJsonWrite(e, t) {
    let n = f0.from(e.seconds).toNumber();
    if (n > 315576e6 || n < -315576e6) throw new Error("Duration value out of range.");
    let a = e.seconds.toString();
    if (n === 0 && e.nanos < 0 && (a = "-" + a), e.nanos !== 0) {
      let s = Math.abs(e.nanos).toString();
      s = "0".repeat(9 - s.length) + s, s.substring(3) === "000000" ? s = s.substring(0, 3) : s.substring(6) === "000" && (s = s.substring(0, 6)), a += "." + s;
    }
    return a + "s";
  }
  /**
  * Decode `Duration` from JSON string like "3.000001s"
  */
  internalJsonRead(e, t, n) {
    if (typeof e != "string") throw new Error("Unable to parse Duration from JSON " + St(e) + ". Expected string.");
    let a = e.match(/^(-?)([0-9]+)(?:\.([0-9]+))?s/);
    if (a === null) throw new Error("Unable to parse Duration from JSON string. Invalid format.");
    n || (n = this.create());
    let [, s, r, i] = a, c = f0.from(s + r);
    if (c.toNumber() > 315576e6 || c.toNumber() < -315576e6) throw new Error("Unable to parse Duration from JSON string. Value out of range.");
    if (n.seconds = c.toBigInt(), typeof i == "string") {
      let o = s + i + "0".repeat(9 - i.length);
      n.nanos = parseInt(o);
    }
    return n;
  }
};
const nb = new tb();
var ab = class extends N {
  constructor() {
    super("sui.rpc.v2.JwkId", [{
      no: 1,
      name: "iss",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "kid",
      kind: "scalar",
      opt: !0,
      T: 9
    }]);
  }
};
const sb = new ab();
var rb = class extends N {
  constructor() {
    super("sui.rpc.v2.Jwk", [
      {
        no: 1,
        name: "kty",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "e",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "n",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "alg",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const ib = new rb();
var cb = class extends N {
  constructor() {
    super("sui.rpc.v2.Bcs", [{
      no: 1,
      name: "name",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "value",
      kind: "scalar",
      opt: !0,
      T: 12
    }]);
  }
};
const ra = new cb();
let Yr = /* @__PURE__ */ function(e) {
  return e[e.NULL_VALUE = 0] = "NULL_VALUE", e;
}({});
var ob = class extends N {
  constructor() {
    super("google.protobuf.Struct", [{
      no: 1,
      name: "fields",
      kind: "map",
      K: 9,
      V: {
        kind: "message",
        T: () => Ne
      }
    }]);
  }
  /**
  * Encode `Struct` to JSON object.
  */
  internalJsonWrite(e, t) {
    let n = {};
    for (let [a, s] of Object.entries(e.fields)) n[a] = Ne.toJson(s);
    return n;
  }
  /**
  * Decode `Struct` from JSON object.
  */
  internalJsonRead(e, t, n) {
    if (!Oo(e)) throw new globalThis.Error("Unable to parse message " + this.typeName + " from JSON " + St(e) + ".");
    n || (n = this.create());
    for (let [a, s] of globalThis.Object.entries(e)) n.fields[a] = Ne.fromJson(s);
    return n;
  }
};
const Zr = new ob();
var db = class extends N {
  constructor() {
    super("google.protobuf.Value", [
      {
        no: 1,
        name: "null_value",
        kind: "enum",
        oneof: "kind",
        T: () => ["google.protobuf.NullValue", Yr]
      },
      {
        no: 2,
        name: "number_value",
        kind: "scalar",
        oneof: "kind",
        T: 1
      },
      {
        no: 3,
        name: "string_value",
        kind: "scalar",
        oneof: "kind",
        T: 9
      },
      {
        no: 4,
        name: "bool_value",
        kind: "scalar",
        oneof: "kind",
        T: 8
      },
      {
        no: 5,
        name: "struct_value",
        kind: "message",
        oneof: "kind",
        T: () => Zr
      },
      {
        no: 6,
        name: "list_value",
        kind: "message",
        oneof: "kind",
        T: () => Hr
      }
    ]);
  }
  /**
  * Encode `Value` to JSON value.
  */
  internalJsonWrite(e, t) {
    if (e.kind.oneofKind === void 0) throw new globalThis.Error();
    switch (e.kind.oneofKind) {
      case void 0:
        throw new globalThis.Error();
      case "boolValue":
        return e.kind.boolValue;
      case "nullValue":
        return null;
      case "numberValue":
        let n = e.kind.numberValue;
        if (typeof n == "number" && !Number.isFinite(n)) throw new globalThis.Error();
        return n;
      case "stringValue":
        return e.kind.stringValue;
      case "listValue":
        let a = this.fields.find((r) => r.no === 6);
        if ((a == null ? void 0 : a.kind) !== "message") throw new globalThis.Error();
        return a.T().toJson(e.kind.listValue);
      case "structValue":
        let s = this.fields.find((r) => r.no === 5);
        if ((s == null ? void 0 : s.kind) !== "message") throw new globalThis.Error();
        return s.T().toJson(e.kind.structValue);
    }
  }
  /**
  * Decode `Value` from JSON value.
  */
  internalJsonRead(e, t, n) {
    switch (n || (n = this.create()), typeof e) {
      case "number":
        n.kind = {
          oneofKind: "numberValue",
          numberValue: e
        };
        break;
      case "string":
        n.kind = {
          oneofKind: "stringValue",
          stringValue: e
        };
        break;
      case "boolean":
        n.kind = {
          oneofKind: "boolValue",
          boolValue: e
        };
        break;
      case "object":
        e === null ? n.kind = {
          oneofKind: "nullValue",
          nullValue: Yr.NULL_VALUE
        } : globalThis.Array.isArray(e) ? n.kind = {
          oneofKind: "listValue",
          listValue: Hr.fromJson(e)
        } : n.kind = {
          oneofKind: "structValue",
          structValue: Zr.fromJson(e)
        };
        break;
      default:
        throw new globalThis.Error("Unable to parse " + this.typeName + " from JSON " + St(e));
    }
    return n;
  }
};
const Ne = new db();
var fb = class extends N {
  constructor() {
    super("google.protobuf.ListValue", [{
      no: 1,
      name: "values",
      kind: "message",
      repeat: 2,
      T: () => Ne
    }]);
  }
  /**
  * Encode `ListValue` to JSON array.
  */
  internalJsonWrite(e, t) {
    return e.values.map((n) => Ne.toJson(n));
  }
  /**
  * Decode `ListValue` from JSON array.
  */
  internalJsonRead(e, t, n) {
    if (!globalThis.Array.isArray(e)) throw new globalThis.Error("Unable to parse " + this.typeName + " from JSON " + St(e));
    n || (n = this.create());
    let a = e.map((s) => Ne.fromJson(s));
    return n.values.push(...a), n;
  }
};
const Hr = new fb();
let ub = /* @__PURE__ */ function(e) {
  return e[e.DATATYPE_KIND_UNKNOWN = 0] = "DATATYPE_KIND_UNKNOWN", e[e.STRUCT = 1] = "STRUCT", e[e.ENUM = 2] = "ENUM", e;
}({}), lb = /* @__PURE__ */ function(e) {
  return e[e.TYPE_UNKNOWN = 0] = "TYPE_UNKNOWN", e[e.ADDRESS = 1] = "ADDRESS", e[e.BOOL = 2] = "BOOL", e[e.U8 = 3] = "U8", e[e.U16 = 4] = "U16", e[e.U32 = 5] = "U32", e[e.U64 = 6] = "U64", e[e.U128 = 7] = "U128", e[e.U256 = 8] = "U256", e[e.VECTOR = 9] = "VECTOR", e[e.DATATYPE = 10] = "DATATYPE", e[e.TYPE_PARAMETER = 11] = "TYPE_PARAMETER", e;
}({}), bb = /* @__PURE__ */ function(e) {
  return e[e.VISIBILITY_UNKNOWN = 0] = "VISIBILITY_UNKNOWN", e[e.PRIVATE = 1] = "PRIVATE", e[e.PUBLIC = 2] = "PUBLIC", e[e.FRIEND = 3] = "FRIEND", e;
}({}), pb = /* @__PURE__ */ function(e) {
  return e[e.REFERENCE_UNKNOWN = 0] = "REFERENCE_UNKNOWN", e[e.IMMUTABLE = 1] = "IMMUTABLE", e[e.MUTABLE = 2] = "MUTABLE", e;
}({}), Bo = /* @__PURE__ */ function(e) {
  return e[e.ABILITY_UNKNOWN = 0] = "ABILITY_UNKNOWN", e[e.COPY = 1] = "COPY", e[e.DROP = 2] = "DROP", e[e.STORE = 3] = "STORE", e[e.KEY = 4] = "KEY", e;
}({});
var mb = class extends N {
  constructor() {
    super("sui.rpc.v2.Package", [
      {
        no: 1,
        name: "storage_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "original_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "modules",
        kind: "message",
        repeat: 2,
        T: () => Ab
      },
      {
        no: 5,
        name: "type_origins",
        kind: "message",
        repeat: 2,
        T: () => xb
      },
      {
        no: 6,
        name: "linkage",
        kind: "message",
        repeat: 2,
        T: () => Bb
      }
    ]);
  }
};
const gb = new mb();
var hb = class extends N {
  constructor() {
    super("sui.rpc.v2.Module", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "contents",
        kind: "scalar",
        opt: !0,
        T: 12
      },
      {
        no: 3,
        name: "datatypes",
        kind: "message",
        repeat: 2,
        T: () => wb
      },
      {
        no: 4,
        name: "functions",
        kind: "message",
        repeat: 2,
        T: () => kb
      }
    ]);
  }
};
const Ab = new hb();
var yb = class extends N {
  constructor() {
    super("sui.rpc.v2.DatatypeDescriptor", [
      {
        no: 1,
        name: "type_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "defining_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "module",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "abilities",
        kind: "enum",
        repeat: 1,
        T: () => ["sui.rpc.v2.Ability", Bo]
      },
      {
        no: 6,
        name: "type_parameters",
        kind: "message",
        repeat: 2,
        T: () => jo
      },
      {
        no: 7,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.DatatypeDescriptor.DatatypeKind", ub]
      },
      {
        no: 8,
        name: "fields",
        kind: "message",
        repeat: 2,
        T: () => Mo
      },
      {
        no: 9,
        name: "variants",
        kind: "message",
        repeat: 2,
        T: () => Ob
      }
    ]);
  }
};
const wb = new yb();
var Tb = class extends N {
  constructor() {
    super("sui.rpc.v2.TypeParameter", [{
      no: 1,
      name: "constraints",
      kind: "enum",
      repeat: 1,
      T: () => ["sui.rpc.v2.Ability", Bo]
    }, {
      no: 2,
      name: "is_phantom",
      kind: "scalar",
      opt: !0,
      T: 8
    }]);
  }
};
const jo = new Tb();
var vb = class extends N {
  constructor() {
    super("sui.rpc.v2.FieldDescriptor", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "position",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 3,
        name: "type",
        kind: "message",
        T: () => $s
      }
    ]);
  }
};
const Mo = new vb();
var Ib = class extends N {
  constructor() {
    super("sui.rpc.v2.VariantDescriptor", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "position",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 3,
        name: "fields",
        kind: "message",
        repeat: 2,
        T: () => Mo
      }
    ]);
  }
};
const Ob = new Ib();
var Eb = class extends N {
  constructor() {
    super("sui.rpc.v2.OpenSignatureBody", [
      {
        no: 1,
        name: "type",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.OpenSignatureBody.Type", lb]
      },
      {
        no: 2,
        name: "type_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "type_parameter_instantiation",
        kind: "message",
        repeat: 2,
        T: () => $s
      },
      {
        no: 4,
        name: "type_parameter",
        kind: "scalar",
        opt: !0,
        T: 13
      }
    ]);
  }
};
const $s = new Eb();
var Sb = class extends N {
  constructor() {
    super("sui.rpc.v2.FunctionDescriptor", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "visibility",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.FunctionDescriptor.Visibility", bb]
      },
      {
        no: 6,
        name: "is_entry",
        kind: "scalar",
        opt: !0,
        T: 8
      },
      {
        no: 7,
        name: "type_parameters",
        kind: "message",
        repeat: 2,
        T: () => jo
      },
      {
        no: 8,
        name: "parameters",
        kind: "message",
        repeat: 2,
        T: () => qr
      },
      {
        no: 9,
        name: "returns",
        kind: "message",
        repeat: 2,
        T: () => qr
      }
    ]);
  }
};
const kb = new Sb();
var Nb = class extends N {
  constructor() {
    super("sui.rpc.v2.OpenSignature", [{
      no: 1,
      name: "reference",
      kind: "enum",
      opt: !0,
      T: () => ["sui.rpc.v2.OpenSignature.Reference", pb]
    }, {
      no: 2,
      name: "body",
      kind: "message",
      T: () => $s
    }]);
  }
};
const qr = new Nb();
var Cb = class extends N {
  constructor() {
    super("sui.rpc.v2.TypeOrigin", [
      {
        no: 1,
        name: "module_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "datatype_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "package_id",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const xb = new Cb();
var _b = class extends N {
  constructor() {
    super("sui.rpc.v2.Linkage", [
      {
        no: 1,
        name: "original_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "upgraded_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "upgraded_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const Bb = new _b();
let jb = /* @__PURE__ */ function(e) {
  return e[e.OWNER_KIND_UNKNOWN = 0] = "OWNER_KIND_UNKNOWN", e[e.ADDRESS = 1] = "ADDRESS", e[e.OBJECT = 2] = "OBJECT", e[e.SHARED = 3] = "SHARED", e[e.IMMUTABLE = 4] = "IMMUTABLE", e[e.CONSENSUS_ADDRESS = 5] = "CONSENSUS_ADDRESS", e;
}({});
var Mb = class extends N {
  constructor() {
    super("sui.rpc.v2.Owner", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.Owner.OwnerKind", jb]
      },
      {
        no: 2,
        name: "address",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const gs = new Mb();
var Rb = class extends N {
  constructor() {
    super("sui.rpc.v2.Object", [
      {
        no: 1,
        name: "bcs",
        kind: "message",
        T: () => ra
      },
      {
        no: 2,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "owner",
        kind: "message",
        T: () => gs
      },
      {
        no: 6,
        name: "object_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 7,
        name: "has_public_transfer",
        kind: "scalar",
        opt: !0,
        T: 8
      },
      {
        no: 8,
        name: "contents",
        kind: "message",
        T: () => ra
      },
      {
        no: 9,
        name: "package",
        kind: "message",
        T: () => gb
      },
      {
        no: 10,
        name: "previous_transaction",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 11,
        name: "storage_rebate",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 100,
        name: "json",
        kind: "message",
        T: () => Ne
      },
      {
        no: 101,
        name: "balance",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 102,
        name: "display",
        kind: "message",
        T: () => Pb
      }
    ]);
  }
};
const Ro = new Rb();
var Db = class extends N {
  constructor() {
    super("sui.rpc.v2.ObjectSet", [{
      no: 1,
      name: "objects",
      kind: "message",
      repeat: 2,
      T: () => Ro
    }]);
  }
};
new Db();
var Ub = class extends N {
  constructor() {
    super("sui.rpc.v2.Display", [{
      no: 1,
      name: "output",
      kind: "message",
      T: () => Ne
    }, {
      no: 2,
      name: "errors",
      kind: "message",
      T: () => Ne
    }]);
  }
};
const Pb = new Ub();
let at = /* @__PURE__ */ function(e) {
  return e[e.ARGUMENT_KIND_UNKNOWN = 0] = "ARGUMENT_KIND_UNKNOWN", e[e.GAS = 1] = "GAS", e[e.INPUT = 2] = "INPUT", e[e.RESULT = 3] = "RESULT", e;
}({});
var Vb = class extends N {
  constructor() {
    super("sui.rpc.v2.Argument", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.Argument.ArgumentKind", at]
      },
      {
        no: 2,
        name: "input",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 3,
        name: "result",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 4,
        name: "subresult",
        kind: "scalar",
        opt: !0,
        T: 13
      }
    ]);
  }
};
const Je = new Vb();
let he = /* @__PURE__ */ function(e) {
  return e[e.INPUT_KIND_UNKNOWN = 0] = "INPUT_KIND_UNKNOWN", e[e.PURE = 1] = "PURE", e[e.IMMUTABLE_OR_OWNED = 2] = "IMMUTABLE_OR_OWNED", e[e.SHARED = 3] = "SHARED", e[e.RECEIVING = 4] = "RECEIVING", e[e.FUNDS_WITHDRAWAL = 5] = "FUNDS_WITHDRAWAL", e;
}({}), Fb = /* @__PURE__ */ function(e) {
  return e[e.MUTABILITY_UNKNOWN = 0] = "MUTABILITY_UNKNOWN", e[e.IMMUTABLE = 1] = "IMMUTABLE", e[e.MUTABLE = 2] = "MUTABLE", e[e.NON_EXCLUSIVE_WRITE = 3] = "NON_EXCLUSIVE_WRITE", e;
}({}), ia = /* @__PURE__ */ function(e) {
  return e[e.SOURCE_UNKNOWN = 0] = "SOURCE_UNKNOWN", e[e.SENDER = 1] = "SENDER", e[e.SPONSOR = 2] = "SPONSOR", e;
}({});
var $b = class extends N {
  constructor() {
    super("sui.rpc.v2.Input", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.Input.InputKind", he]
      },
      {
        no: 2,
        name: "pure",
        kind: "scalar",
        opt: !0,
        T: 12
      },
      {
        no: 3,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 6,
        name: "mutable",
        kind: "scalar",
        opt: !0,
        T: 8
      },
      {
        no: 7,
        name: "mutability",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.Input.Mutability", Fb]
      },
      {
        no: 8,
        name: "funds_withdrawal",
        kind: "message",
        T: () => Gb
      },
      {
        no: 1e3,
        name: "literal",
        kind: "message",
        T: () => Ne
      }
    ]);
  }
};
const Lb = new $b();
var zb = class extends N {
  constructor() {
    super("sui.rpc.v2.FundsWithdrawal", [
      {
        no: 1,
        name: "amount",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "coin_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "source",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.FundsWithdrawal.Source", ia]
      }
    ]);
  }
};
const Gb = new zb();
var Wb = class extends N {
  constructor() {
    super("google.protobuf.Timestamp", [{
      no: 1,
      name: "seconds",
      kind: "scalar",
      T: 3,
      L: 0
    }, {
      no: 2,
      name: "nanos",
      kind: "scalar",
      T: 5
    }]);
  }
  /**
  * Creates a new `Timestamp` for the current time.
  */
  now() {
    const e = this.create(), t = Date.now();
    return e.seconds = f0.from(Math.floor(t / 1e3)).toBigInt(), e.nanos = t % 1e3 * 1e6, e;
  }
  /**
  * Converts a `Timestamp` to a JavaScript Date.
  */
  toDate(e) {
    return new Date(f0.from(e.seconds).toNumber() * 1e3 + Math.ceil(e.nanos / 1e6));
  }
  /**
  * Converts a JavaScript Date to a `Timestamp`.
  */
  fromDate(e) {
    const t = this.create(), n = e.getTime();
    return t.seconds = f0.from(Math.floor(n / 1e3)).toBigInt(), t.nanos = (n % 1e3 + (n < 0 && n % 1e3 !== 0 ? 1e3 : 0)) * 1e6, t;
  }
  /**
  * In JSON format, the `Timestamp` type is encoded as a string
  * in the RFC 3339 format.
  */
  internalJsonWrite(e, t) {
    let n = f0.from(e.seconds).toNumber() * 1e3;
    if (n < Date.parse("0001-01-01T00:00:00Z") || n > Date.parse("9999-12-31T23:59:59Z")) throw new Error("Unable to encode Timestamp to JSON. Must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive.");
    if (e.nanos < 0) throw new Error("Unable to encode invalid Timestamp to JSON. Nanos must not be negative.");
    let a = "Z";
    if (e.nanos > 0) {
      let s = (e.nanos + 1e9).toString().substring(1);
      s.substring(3) === "000000" ? a = "." + s.substring(0, 3) + "Z" : s.substring(6) === "000" ? a = "." + s.substring(0, 6) + "Z" : a = "." + s + "Z";
    }
    return new Date(n).toISOString().replace(".000Z", a);
  }
  /**
  * In JSON format, the `Timestamp` type is encoded as a string
  * in the RFC 3339 format.
  */
  internalJsonRead(e, t, n) {
    if (typeof e != "string") throw new Error("Unable to parse Timestamp from JSON " + St(e) + ".");
    let a = e.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:Z|\.([0-9]{3,9})Z|([+-][0-9][0-9]:[0-9][0-9]))$/);
    if (!a) throw new Error("Unable to parse Timestamp from JSON. Invalid format.");
    let s = Date.parse(a[1] + "-" + a[2] + "-" + a[3] + "T" + a[4] + ":" + a[5] + ":" + a[6] + (a[8] ? a[8] : "Z"));
    if (Number.isNaN(s)) throw new Error("Unable to parse Timestamp from JSON. Invalid value.");
    if (s < Date.parse("0001-01-01T00:00:00Z") || s > Date.parse("9999-12-31T23:59:59Z")) throw new globalThis.Error("Unable to parse Timestamp from JSON. Must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive.");
    return n || (n = this.create()), n.seconds = f0.from(s / 1e3).toBigInt(), n.nanos = 0, a[7] && (n.nanos = parseInt("1" + a[7] + "0".repeat(9 - a[7].length)) - 1e9), n;
  }
};
const ca = new Wb();
var Qb = class extends N {
  constructor() {
    super("sui.rpc.v2.ObjectReference", [
      {
        no: 1,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const Do = new Qb();
let Tt = /* @__PURE__ */ function(e) {
  return e[e.TRANSACTION_EXPIRATION_KIND_UNKNOWN = 0] = "TRANSACTION_EXPIRATION_KIND_UNKNOWN", e[e.NONE = 1] = "NONE", e[e.EPOCH = 2] = "EPOCH", e[e.VALID_DURING = 3] = "VALID_DURING", e;
}({}), Jb = /* @__PURE__ */ function(e) {
  return e[e.KIND_UNKNOWN = 0] = "KIND_UNKNOWN", e[e.PROGRAMMABLE_TRANSACTION = 1] = "PROGRAMMABLE_TRANSACTION", e[e.CHANGE_EPOCH = 2] = "CHANGE_EPOCH", e[e.GENESIS = 3] = "GENESIS", e[e.CONSENSUS_COMMIT_PROLOGUE_V1 = 4] = "CONSENSUS_COMMIT_PROLOGUE_V1", e[e.AUTHENTICATOR_STATE_UPDATE = 5] = "AUTHENTICATOR_STATE_UPDATE", e[e.END_OF_EPOCH = 6] = "END_OF_EPOCH", e[e.RANDOMNESS_STATE_UPDATE = 7] = "RANDOMNESS_STATE_UPDATE", e[e.CONSENSUS_COMMIT_PROLOGUE_V2 = 8] = "CONSENSUS_COMMIT_PROLOGUE_V2", e[e.CONSENSUS_COMMIT_PROLOGUE_V3 = 9] = "CONSENSUS_COMMIT_PROLOGUE_V3", e[e.CONSENSUS_COMMIT_PROLOGUE_V4 = 10] = "CONSENSUS_COMMIT_PROLOGUE_V4", e[e.PROGRAMMABLE_SYSTEM_TRANSACTION = 11] = "PROGRAMMABLE_SYSTEM_TRANSACTION", e;
}({}), Yb = /* @__PURE__ */ function(e) {
  return e[e.KIND_UNKNOWN = 0] = "KIND_UNKNOWN", e[e.CHANGE_EPOCH = 1] = "CHANGE_EPOCH", e[e.AUTHENTICATOR_STATE_CREATE = 2] = "AUTHENTICATOR_STATE_CREATE", e[e.AUTHENTICATOR_STATE_EXPIRE = 3] = "AUTHENTICATOR_STATE_EXPIRE", e[e.RANDOMNESS_STATE_CREATE = 4] = "RANDOMNESS_STATE_CREATE", e[e.DENY_LIST_STATE_CREATE = 5] = "DENY_LIST_STATE_CREATE", e[e.BRIDGE_STATE_CREATE = 6] = "BRIDGE_STATE_CREATE", e[e.BRIDGE_COMMITTEE_INIT = 7] = "BRIDGE_COMMITTEE_INIT", e[e.STORE_EXECUTION_TIME_OBSERVATIONS = 8] = "STORE_EXECUTION_TIME_OBSERVATIONS", e[e.ACCUMULATOR_ROOT_CREATE = 9] = "ACCUMULATOR_ROOT_CREATE", e[e.COIN_REGISTRY_CREATE = 10] = "COIN_REGISTRY_CREATE", e[e.DISPLAY_REGISTRY_CREATE = 11] = "DISPLAY_REGISTRY_CREATE", e[e.ADDRESS_ALIAS_STATE_CREATE = 12] = "ADDRESS_ALIAS_STATE_CREATE", e[e.WRITE_ACCUMULATOR_STORAGE_COST = 13] = "WRITE_ACCUMULATOR_STORAGE_COST", e;
}({}), Zb = /* @__PURE__ */ function(e) {
  return e[e.EXECUTION_TIME_OBSERVATION_KIND_UNKNOWN = 0] = "EXECUTION_TIME_OBSERVATION_KIND_UNKNOWN", e[e.MOVE_ENTRY_POINT = 1] = "MOVE_ENTRY_POINT", e[e.TRANSFER_OBJECTS = 2] = "TRANSFER_OBJECTS", e[e.SPLIT_COINS = 3] = "SPLIT_COINS", e[e.MERGE_COINS = 4] = "MERGE_COINS", e[e.PUBLISH = 5] = "PUBLISH", e[e.MAKE_MOVE_VECTOR = 6] = "MAKE_MOVE_VECTOR", e[e.UPGRADE = 7] = "UPGRADE", e;
}({});
var Hb = class extends N {
  constructor() {
    super("sui.rpc.v2.Transaction", [
      {
        no: 1,
        name: "bcs",
        kind: "message",
        T: () => ra
      },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 5
      },
      {
        no: 4,
        name: "kind",
        kind: "message",
        T: () => n2
      },
      {
        no: 5,
        name: "sender",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 6,
        name: "gas_payment",
        kind: "message",
        T: () => Xb
      },
      {
        no: 7,
        name: "expiration",
        kind: "message",
        T: () => e2
      }
    ]);
  }
};
const Ls = new Hb();
var qb = class extends N {
  constructor() {
    super("sui.rpc.v2.GasPayment", [
      {
        no: 1,
        name: "objects",
        kind: "message",
        repeat: 2,
        T: () => Do
      },
      {
        no: 2,
        name: "owner",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "price",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "budget",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const Xb = new qb();
var Kb = class extends N {
  constructor() {
    super("sui.rpc.v2.TransactionExpiration", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.TransactionExpiration.TransactionExpirationKind", Tt]
      },
      {
        no: 2,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "min_epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "min_timestamp",
        kind: "message",
        T: () => ca
      },
      {
        no: 5,
        name: "max_timestamp",
        kind: "message",
        T: () => ca
      },
      {
        no: 6,
        name: "chain",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 7,
        name: "nonce",
        kind: "scalar",
        opt: !0,
        T: 13
      }
    ]);
  }
};
const e2 = new Kb();
var t2 = class extends N {
  constructor() {
    super("sui.rpc.v2.TransactionKind", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.TransactionKind.Kind", Jb]
      },
      {
        no: 2,
        name: "programmable_transaction",
        kind: "message",
        oneof: "data",
        T: () => s2
      },
      {
        no: 3,
        name: "change_epoch",
        kind: "message",
        oneof: "data",
        T: () => Po
      },
      {
        no: 4,
        name: "genesis",
        kind: "message",
        oneof: "data",
        T: () => S2
      },
      {
        no: 5,
        name: "consensus_commit_prologue",
        kind: "message",
        oneof: "data",
        T: () => N2
      },
      {
        no: 6,
        name: "authenticator_state_update",
        kind: "message",
        oneof: "data",
        T: () => D2
      },
      {
        no: 7,
        name: "end_of_epoch",
        kind: "message",
        oneof: "data",
        T: () => F2
      },
      {
        no: 8,
        name: "randomness_state_update",
        kind: "message",
        oneof: "data",
        T: () => T2
      }
    ]);
  }
};
const n2 = new t2();
var a2 = class extends N {
  constructor() {
    super("sui.rpc.v2.ProgrammableTransaction", [{
      no: 1,
      name: "inputs",
      kind: "message",
      repeat: 2,
      T: () => Lb
    }, {
      no: 2,
      name: "commands",
      kind: "message",
      repeat: 2,
      T: () => i2
    }]);
  }
};
const s2 = new a2();
var r2 = class extends N {
  constructor() {
    super("sui.rpc.v2.Command", [
      {
        no: 1,
        name: "move_call",
        kind: "message",
        oneof: "command",
        T: () => Uo
      },
      {
        no: 2,
        name: "transfer_objects",
        kind: "message",
        oneof: "command",
        T: () => d2
      },
      {
        no: 3,
        name: "split_coins",
        kind: "message",
        oneof: "command",
        T: () => u2
      },
      {
        no: 4,
        name: "merge_coins",
        kind: "message",
        oneof: "command",
        T: () => b2
      },
      {
        no: 5,
        name: "publish",
        kind: "message",
        oneof: "command",
        T: () => m2
      },
      {
        no: 6,
        name: "make_move_vector",
        kind: "message",
        oneof: "command",
        T: () => h2
      },
      {
        no: 7,
        name: "upgrade",
        kind: "message",
        oneof: "command",
        T: () => y2
      }
    ]);
  }
};
const i2 = new r2();
var c2 = class extends N {
  constructor() {
    super("sui.rpc.v2.MoveCall", [
      {
        no: 1,
        name: "package",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "module",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "function",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "type_arguments",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 5,
        name: "arguments",
        kind: "message",
        repeat: 2,
        T: () => Je
      }
    ]);
  }
};
const Uo = new c2();
var o2 = class extends N {
  constructor() {
    super("sui.rpc.v2.TransferObjects", [{
      no: 1,
      name: "objects",
      kind: "message",
      repeat: 2,
      T: () => Je
    }, {
      no: 2,
      name: "address",
      kind: "message",
      T: () => Je
    }]);
  }
};
const d2 = new o2();
var f2 = class extends N {
  constructor() {
    super("sui.rpc.v2.SplitCoins", [{
      no: 1,
      name: "coin",
      kind: "message",
      T: () => Je
    }, {
      no: 2,
      name: "amounts",
      kind: "message",
      repeat: 2,
      T: () => Je
    }]);
  }
};
const u2 = new f2();
var l2 = class extends N {
  constructor() {
    super("sui.rpc.v2.MergeCoins", [{
      no: 1,
      name: "coin",
      kind: "message",
      T: () => Je
    }, {
      no: 2,
      name: "coins_to_merge",
      kind: "message",
      repeat: 2,
      T: () => Je
    }]);
  }
};
const b2 = new l2();
var p2 = class extends N {
  constructor() {
    super("sui.rpc.v2.Publish", [{
      no: 1,
      name: "modules",
      kind: "scalar",
      repeat: 2,
      T: 12
    }, {
      no: 2,
      name: "dependencies",
      kind: "scalar",
      repeat: 2,
      T: 9
    }]);
  }
};
const m2 = new p2();
var g2 = class extends N {
  constructor() {
    super("sui.rpc.v2.MakeMoveVector", [{
      no: 1,
      name: "element_type",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "elements",
      kind: "message",
      repeat: 2,
      T: () => Je
    }]);
  }
};
const h2 = new g2();
var A2 = class extends N {
  constructor() {
    super("sui.rpc.v2.Upgrade", [
      {
        no: 1,
        name: "modules",
        kind: "scalar",
        repeat: 2,
        T: 12
      },
      {
        no: 2,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 3,
        name: "package",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "ticket",
        kind: "message",
        T: () => Je
      }
    ]);
  }
};
const y2 = new A2();
var w2 = class extends N {
  constructor() {
    super("sui.rpc.v2.RandomnessStateUpdate", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "randomness_round",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "random_bytes",
        kind: "scalar",
        opt: !0,
        T: 12
      },
      {
        no: 4,
        name: "randomness_object_initial_shared_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const T2 = new w2();
var v2 = class extends N {
  constructor() {
    super("sui.rpc.v2.ChangeEpoch", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "protocol_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "storage_charge",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "computation_charge",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "storage_rebate",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "non_refundable_storage_fee",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 7,
        name: "epoch_start_timestamp",
        kind: "message",
        T: () => ca
      },
      {
        no: 8,
        name: "system_packages",
        kind: "message",
        repeat: 2,
        T: () => O2
      }
    ]);
  }
};
const Po = new v2();
var I2 = class extends N {
  constructor() {
    super("sui.rpc.v2.SystemPackage", [
      {
        no: 1,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "modules",
        kind: "scalar",
        repeat: 2,
        T: 12
      },
      {
        no: 3,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      }
    ]);
  }
};
const O2 = new I2();
var E2 = class extends N {
  constructor() {
    super("sui.rpc.v2.GenesisTransaction", [{
      no: 1,
      name: "objects",
      kind: "message",
      repeat: 2,
      T: () => Ro
    }]);
  }
};
const S2 = new E2();
var k2 = class extends N {
  constructor() {
    super("sui.rpc.v2.ConsensusCommitPrologue", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "round",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "commit_timestamp",
        kind: "message",
        T: () => ca
      },
      {
        no: 4,
        name: "consensus_commit_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "sub_dag_index",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "consensus_determined_version_assignments",
        kind: "message",
        T: () => M2
      },
      {
        no: 7,
        name: "additional_state_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const N2 = new k2();
var C2 = class extends N {
  constructor() {
    super("sui.rpc.v2.VersionAssignment", [
      {
        no: 1,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "start_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const x2 = new C2();
var _2 = class extends N {
  constructor() {
    super("sui.rpc.v2.CanceledTransaction", [{
      no: 1,
      name: "digest",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "version_assignments",
      kind: "message",
      repeat: 2,
      T: () => x2
    }]);
  }
};
const B2 = new _2();
var j2 = class extends N {
  constructor() {
    super("sui.rpc.v2.ConsensusDeterminedVersionAssignments", [{
      no: 1,
      name: "version",
      kind: "scalar",
      opt: !0,
      T: 5
    }, {
      no: 3,
      name: "canceled_transactions",
      kind: "message",
      repeat: 2,
      T: () => B2
    }]);
  }
};
const M2 = new j2();
var R2 = class extends N {
  constructor() {
    super("sui.rpc.v2.AuthenticatorStateUpdate", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "round",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "new_active_jwks",
        kind: "message",
        repeat: 2,
        T: () => P2
      },
      {
        no: 4,
        name: "authenticator_object_initial_shared_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const D2 = new R2();
var U2 = class extends N {
  constructor() {
    super("sui.rpc.v2.ActiveJwk", [
      {
        no: 1,
        name: "id",
        kind: "message",
        T: () => sb
      },
      {
        no: 2,
        name: "jwk",
        kind: "message",
        T: () => ib
      },
      {
        no: 3,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const P2 = new U2();
var V2 = class extends N {
  constructor() {
    super("sui.rpc.v2.EndOfEpochTransaction", [{
      no: 1,
      name: "transactions",
      kind: "message",
      repeat: 2,
      T: () => L2
    }]);
  }
};
const F2 = new V2();
var $2 = class extends N {
  constructor() {
    super("sui.rpc.v2.EndOfEpochTransactionKind", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.EndOfEpochTransactionKind.Kind", Yb]
      },
      {
        no: 2,
        name: "change_epoch",
        kind: "message",
        oneof: "data",
        T: () => Po
      },
      {
        no: 3,
        name: "authenticator_state_expire",
        kind: "message",
        oneof: "data",
        T: () => G2
      },
      {
        no: 4,
        name: "execution_time_observations",
        kind: "message",
        oneof: "data",
        T: () => Q2
      },
      {
        no: 5,
        name: "bridge_chain_id",
        kind: "scalar",
        oneof: "data",
        T: 9
      },
      {
        no: 6,
        name: "bridge_object_version",
        kind: "scalar",
        oneof: "data",
        T: 4,
        L: 0
      },
      {
        no: 7,
        name: "storage_cost",
        kind: "scalar",
        oneof: "data",
        T: 4,
        L: 0
      }
    ]);
  }
};
const L2 = new $2();
var z2 = class extends N {
  constructor() {
    super("sui.rpc.v2.AuthenticatorStateExpire", [{
      no: 1,
      name: "min_epoch",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }, {
      no: 2,
      name: "authenticator_object_initial_shared_version",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }]);
  }
};
const G2 = new z2();
var W2 = class extends N {
  constructor() {
    super("sui.rpc.v2.ExecutionTimeObservations", [{
      no: 1,
      name: "version",
      kind: "scalar",
      opt: !0,
      T: 5
    }, {
      no: 2,
      name: "observations",
      kind: "message",
      repeat: 2,
      T: () => Y2
    }]);
  }
};
const Q2 = new W2();
var J2 = class extends N {
  constructor() {
    super("sui.rpc.v2.ExecutionTimeObservation", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.ExecutionTimeObservation.ExecutionTimeObservationKind", Zb]
      },
      {
        no: 2,
        name: "move_entry_point",
        kind: "message",
        T: () => Uo
      },
      {
        no: 3,
        name: "validator_observations",
        kind: "message",
        repeat: 2,
        T: () => H2
      }
    ]);
  }
};
const Y2 = new J2();
var Z2 = class extends N {
  constructor() {
    super("sui.rpc.v2.ValidatorExecutionTimeObservation", [{
      no: 1,
      name: "validator",
      kind: "scalar",
      opt: !0,
      T: 12
    }, {
      no: 2,
      name: "duration",
      kind: "message",
      T: () => nb
    }]);
  }
};
const H2 = new Z2();
function q2(e) {
  switch (e.$kind) {
    case "Pure":
      return {
        kind: he.PURE,
        pure: ae(e.Pure.bytes)
      };
    case "Object":
      if (e.Object.$kind === "ImmOrOwnedObject") return {
        kind: he.IMMUTABLE_OR_OWNED,
        objectId: e.Object.ImmOrOwnedObject.objectId,
        version: BigInt(e.Object.ImmOrOwnedObject.version),
        digest: e.Object.ImmOrOwnedObject.digest
      };
      if (e.Object.$kind === "SharedObject") return {
        kind: he.SHARED,
        objectId: e.Object.SharedObject.objectId,
        version: BigInt(e.Object.SharedObject.initialSharedVersion),
        mutable: e.Object.SharedObject.mutable
      };
      if (e.Object.$kind === "Receiving") return {
        kind: he.RECEIVING,
        objectId: e.Object.Receiving.objectId,
        version: BigInt(e.Object.Receiving.version),
        digest: e.Object.Receiving.digest
      };
      throw new Error(`Unknown Object kind: ${JSON.stringify(e.Object)}`);
    case "UnresolvedObject":
      const t = e.UnresolvedObject;
      return {
        objectId: t.objectId,
        version: t.version ? BigInt(t.version) : t.initialSharedVersion ? BigInt(t.initialSharedVersion) : void 0,
        digest: t.digest ?? void 0,
        mutable: t.mutable ?? void 0
      };
    case "UnresolvedPure":
      throw new Error("UnresolvedPure arguments must be resolved before converting to gRPC format");
    case "FundsWithdrawal": {
      const n = e.FundsWithdrawal;
      return {
        kind: he.FUNDS_WITHDRAWAL,
        fundsWithdrawal: {
          amount: n.reservation.$kind === "MaxAmountU64" ? BigInt(n.reservation.MaxAmountU64) : void 0,
          coinType: n.typeArg.$kind === "Balance" ? n.typeArg.Balance : void 0,
          source: n.withdrawFrom.$kind === "Sponsor" ? ia.SPONSOR : ia.SENDER
        }
      };
    }
    default:
      throw new Error(`Unknown CallArg kind: ${JSON.stringify(e)}`);
  }
}
function Me(e) {
  if ("GasCoin" in e) return { kind: at.GAS };
  if ("Input" in e) return {
    kind: at.INPUT,
    input: e.Input
  };
  if ("Result" in e) return {
    kind: at.RESULT,
    result: e.Result
  };
  if ("NestedResult" in e) return {
    kind: at.RESULT,
    result: e.NestedResult[0],
    subresult: e.NestedResult[1]
  };
  throw new Error(`Unknown Argument: ${JSON.stringify(e)}`);
}
function X2(e) {
  switch (e.$kind) {
    case "MoveCall":
      return { command: {
        oneofKind: "moveCall",
        moveCall: {
          package: e.MoveCall.package,
          module: e.MoveCall.module,
          function: e.MoveCall.function,
          typeArguments: e.MoveCall.typeArguments,
          arguments: e.MoveCall.arguments.map(Me)
        }
      } };
    case "TransferObjects":
      return { command: {
        oneofKind: "transferObjects",
        transferObjects: {
          objects: e.TransferObjects.objects.map(Me),
          address: Me(e.TransferObjects.address)
        }
      } };
    case "SplitCoins":
      return { command: {
        oneofKind: "splitCoins",
        splitCoins: {
          coin: Me(e.SplitCoins.coin),
          amounts: e.SplitCoins.amounts.map(Me)
        }
      } };
    case "MergeCoins":
      return { command: {
        oneofKind: "mergeCoins",
        mergeCoins: {
          coin: Me(e.MergeCoins.destination),
          coinsToMerge: e.MergeCoins.sources.map(Me)
        }
      } };
    case "Publish":
      return { command: {
        oneofKind: "publish",
        publish: {
          modules: e.Publish.modules.map((t) => ae(t)),
          dependencies: e.Publish.dependencies
        }
      } };
    case "MakeMoveVec":
      return { command: {
        oneofKind: "makeMoveVector",
        makeMoveVector: {
          elementType: e.MakeMoveVec.type ?? void 0,
          elements: e.MakeMoveVec.elements.map(Me)
        }
      } };
    case "Upgrade":
      return { command: {
        oneofKind: "upgrade",
        upgrade: {
          modules: e.Upgrade.modules.map((t) => ae(t)),
          dependencies: e.Upgrade.dependencies,
          package: e.Upgrade.package,
          ticket: Me(e.Upgrade.ticket)
        }
      } };
    default:
      throw new Error(`Unknown Command kind: ${JSON.stringify(e)}`);
  }
}
function Vo(e) {
  const t = {
    version: 1,
    kind: { data: {
      oneofKind: "programmableTransaction",
      programmableTransaction: {
        inputs: e.inputs.map(q2),
        commands: e.commands.map(X2)
      }
    } }
  };
  e.sender && (t.sender = e.sender);
  const n = e.gasData.owner ?? e.sender;
  if (t.gasPayment = {
    objects: e.gasData.payment ? e.gasData.payment.map((a) => ({
      objectId: a.objectId,
      version: BigInt(a.version),
      digest: a.digest
    })) : [],
    price: e.gasData.price ? BigInt(e.gasData.price) : void 0,
    budget: e.gasData.budget ? BigInt(e.gasData.budget) : void 0
  }, n && (t.gasPayment.owner = n), e.expiration) {
    if ("None" in e.expiration) t.expiration = { kind: Tt.NONE };
    else if (e.expiration.$kind === "Epoch") t.expiration = {
      kind: Tt.EPOCH,
      epoch: BigInt(e.expiration.Epoch)
    };
    else if (e.expiration.$kind === "ValidDuring") {
      const a = e.expiration.ValidDuring;
      t.expiration = {
        kind: Tt.VALID_DURING,
        minEpoch: a.minEpoch != null ? BigInt(a.minEpoch) : void 0,
        epoch: a.maxEpoch != null ? BigInt(a.maxEpoch) : void 0,
        chain: a.chain,
        nonce: a.nonce
      };
    }
  }
  return t;
}
function K2(e) {
  const t = e.getData();
  return t.sender || (t.sender = "0x0000000000000000000000000000000000000000000000000000000000000000"), Vo(t);
}
function e8(e) {
  const t = K2(e);
  return Ls.toJson(t);
}
function t8(e) {
  var t, n, a, s;
  switch (e.kind) {
    case he.PURE:
      return {
        $kind: "Pure",
        Pure: { bytes: Q0(e.pure) }
      };
    case he.IMMUTABLE_OR_OWNED:
      return {
        $kind: "Object",
        Object: {
          $kind: "ImmOrOwnedObject",
          ImmOrOwnedObject: {
            objectId: e.objectId,
            version: e.version.toString(),
            digest: e.digest
          }
        }
      };
    case he.SHARED:
      return {
        $kind: "Object",
        Object: {
          $kind: "SharedObject",
          SharedObject: {
            objectId: e.objectId,
            initialSharedVersion: e.version.toString(),
            mutable: e.mutable ?? !1
          }
        }
      };
    case he.RECEIVING:
      return {
        $kind: "Object",
        Object: {
          $kind: "Receiving",
          Receiving: {
            objectId: e.objectId,
            version: e.version.toString(),
            digest: e.digest
          }
        }
      };
    case he.FUNDS_WITHDRAWAL:
      return {
        $kind: "FundsWithdrawal",
        FundsWithdrawal: {
          reservation: {
            $kind: "MaxAmountU64",
            MaxAmountU64: ((n = (t = e.fundsWithdrawal) == null ? void 0 : t.amount) == null ? void 0 : n.toString()) ?? "0"
          },
          typeArg: {
            $kind: "Balance",
            Balance: ((a = e.fundsWithdrawal) == null ? void 0 : a.coinType) ?? "0x2::sui::SUI"
          },
          withdrawFrom: ((s = e.fundsWithdrawal) == null ? void 0 : s.source) === ia.SPONSOR ? {
            $kind: "Sponsor",
            Sponsor: !0
          } : {
            $kind: "Sender",
            Sender: !0
          }
        }
      };
    default:
      throw new Error(`Unknown Input kind: ${JSON.stringify(e)}`);
  }
}
function Re(e) {
  switch (e.kind) {
    case at.GAS:
      return {
        $kind: "GasCoin",
        GasCoin: !0
      };
    case at.INPUT:
      return {
        $kind: "Input",
        Input: e.input
      };
    case at.RESULT:
      return e.subresult != null ? {
        $kind: "NestedResult",
        NestedResult: [e.result, e.subresult]
      } : {
        $kind: "Result",
        Result: e.result
      };
    default:
      throw new Error(`Unknown Argument kind: ${JSON.stringify(e)}`);
  }
}
function n8(e) {
  const t = e.command;
  if (!t) throw new Error("Command is missing");
  switch (t.oneofKind) {
    case "moveCall":
      return {
        $kind: "MoveCall",
        MoveCall: {
          package: t.moveCall.package,
          module: t.moveCall.module,
          function: t.moveCall.function,
          typeArguments: t.moveCall.typeArguments ?? [],
          arguments: t.moveCall.arguments.map(Re)
        }
      };
    case "transferObjects":
      return {
        $kind: "TransferObjects",
        TransferObjects: {
          objects: t.transferObjects.objects.map(Re),
          address: Re(t.transferObjects.address)
        }
      };
    case "splitCoins":
      return {
        $kind: "SplitCoins",
        SplitCoins: {
          coin: Re(t.splitCoins.coin),
          amounts: t.splitCoins.amounts.map(Re)
        }
      };
    case "mergeCoins":
      return {
        $kind: "MergeCoins",
        MergeCoins: {
          destination: Re(t.mergeCoins.coin),
          sources: t.mergeCoins.coinsToMerge.map(Re)
        }
      };
    case "publish":
      return {
        $kind: "Publish",
        Publish: {
          modules: t.publish.modules.map((n) => Q0(n)),
          dependencies: t.publish.dependencies ?? []
        }
      };
    case "makeMoveVector":
      return {
        $kind: "MakeMoveVec",
        MakeMoveVec: {
          type: t.makeMoveVector.elementType ?? null,
          elements: t.makeMoveVector.elements.map(Re)
        }
      };
    case "upgrade":
      return {
        $kind: "Upgrade",
        Upgrade: {
          modules: t.upgrade.modules.map((n) => Q0(n)),
          dependencies: t.upgrade.dependencies ?? [],
          package: t.upgrade.package,
          ticket: Re(t.upgrade.ticket)
        }
      };
    default:
      throw new Error(`Unknown Command kind: ${JSON.stringify(t)}`);
  }
}
function a8(e) {
  var r, i, c, o, d, u, l, b, p, m;
  const t = (r = e.kind) == null ? void 0 : r.data;
  if ((t == null ? void 0 : t.oneofKind) !== "programmableTransaction") throw new Error("Only programmable transactions are supported");
  const n = t.programmableTransaction.inputs.map(t8), a = t.programmableTransaction.commands.map(n8);
  let s = null;
  if (e.expiration) switch (e.expiration.kind) {
    case Tt.NONE:
      s = {
        $kind: "None",
        None: !0
      };
      break;
    case Tt.EPOCH:
      s = {
        $kind: "Epoch",
        Epoch: e.expiration.epoch.toString()
      };
      break;
    case Tt.VALID_DURING:
      s = {
        $kind: "ValidDuring",
        ValidDuring: {
          minEpoch: ((i = e.expiration.minEpoch) == null ? void 0 : i.toString()) ?? null,
          maxEpoch: ((c = e.expiration.epoch) == null ? void 0 : c.toString()) ?? null,
          minTimestamp: null,
          maxTimestamp: null,
          chain: e.expiration.chain ?? "",
          nonce: e.expiration.nonce ?? 0
        }
      };
      break;
  }
  return {
    version: 2,
    sender: e.sender ?? null,
    expiration: s,
    gasData: {
      budget: ((d = (o = e.gasPayment) == null ? void 0 : o.budget) == null ? void 0 : d.toString()) ?? null,
      owner: ((u = e.gasPayment) == null ? void 0 : u.owner) ?? null,
      payment: ((b = (l = e.gasPayment) == null ? void 0 : l.objects) == null ? void 0 : b.map((h) => ({
        objectId: h.objectId,
        version: h.version.toString(),
        digest: h.digest
      }))) ?? null,
      price: ((m = (p = e.gasPayment) == null ? void 0 : p.price) == null ? void 0 : m.toString()) ?? null
    },
    inputs: n,
    commands: a
  };
}
async function s8({ transactionData: e, client: t, epoch: n, originalTransactionData: a, isTransactionKindOnly: s, doGasSelection: r }) {
  var d;
  if (s || r || a.expiration || ((d = a.gasData.payment) == null ? void 0 : d.length) !== 0 || e.expiration && e.expiration.$kind !== "None") return;
  const [{ chainIdentifier: i }, c] = await Promise.all([t.core.getChainIdentifier(), n == null ? t.core.getCurrentSystemState() : null]), o = BigInt(n ?? c.systemState.epoch);
  e.expiration = {
    $kind: "ValidDuring",
    ValidDuring: {
      minEpoch: String(o),
      maxEpoch: String(o + 1n),
      minTimestamp: null,
      maxTimestamp: null,
      chain: i,
      nonce: Math.random() * 4294967296 >>> 0
    }
  };
}
var r8 = class extends N {
  constructor() {
    super("sui.rpc.v2.BalanceChange", [
      {
        no: 1,
        name: "address",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "coin_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "amount",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const i8 = new r8();
var c8 = class extends N {
  constructor() {
    super("sui.rpc.v2.GasCostSummary", [
      {
        no: 1,
        name: "computation_cost",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "storage_cost",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "storage_rebate",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "non_refundable_storage_fee",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      }
    ]);
  }
};
const o8 = new c8();
let d8 = /* @__PURE__ */ function(e) {
  return e[e.EXECUTION_ERROR_KIND_UNKNOWN = 0] = "EXECUTION_ERROR_KIND_UNKNOWN", e[e.INSUFFICIENT_GAS = 1] = "INSUFFICIENT_GAS", e[e.INVALID_GAS_OBJECT = 2] = "INVALID_GAS_OBJECT", e[e.INVARIANT_VIOLATION = 3] = "INVARIANT_VIOLATION", e[e.FEATURE_NOT_YET_SUPPORTED = 4] = "FEATURE_NOT_YET_SUPPORTED", e[e.OBJECT_TOO_BIG = 5] = "OBJECT_TOO_BIG", e[e.PACKAGE_TOO_BIG = 6] = "PACKAGE_TOO_BIG", e[e.CIRCULAR_OBJECT_OWNERSHIP = 7] = "CIRCULAR_OBJECT_OWNERSHIP", e[e.INSUFFICIENT_COIN_BALANCE = 8] = "INSUFFICIENT_COIN_BALANCE", e[e.COIN_BALANCE_OVERFLOW = 9] = "COIN_BALANCE_OVERFLOW", e[e.PUBLISH_ERROR_NON_ZERO_ADDRESS = 10] = "PUBLISH_ERROR_NON_ZERO_ADDRESS", e[e.SUI_MOVE_VERIFICATION_ERROR = 11] = "SUI_MOVE_VERIFICATION_ERROR", e[e.MOVE_PRIMITIVE_RUNTIME_ERROR = 12] = "MOVE_PRIMITIVE_RUNTIME_ERROR", e[e.MOVE_ABORT = 13] = "MOVE_ABORT", e[e.VM_VERIFICATION_OR_DESERIALIZATION_ERROR = 14] = "VM_VERIFICATION_OR_DESERIALIZATION_ERROR", e[e.VM_INVARIANT_VIOLATION = 15] = "VM_INVARIANT_VIOLATION", e[e.FUNCTION_NOT_FOUND = 16] = "FUNCTION_NOT_FOUND", e[e.ARITY_MISMATCH = 17] = "ARITY_MISMATCH", e[e.TYPE_ARITY_MISMATCH = 18] = "TYPE_ARITY_MISMATCH", e[e.NON_ENTRY_FUNCTION_INVOKED = 19] = "NON_ENTRY_FUNCTION_INVOKED", e[e.COMMAND_ARGUMENT_ERROR = 20] = "COMMAND_ARGUMENT_ERROR", e[e.TYPE_ARGUMENT_ERROR = 21] = "TYPE_ARGUMENT_ERROR", e[e.UNUSED_VALUE_WITHOUT_DROP = 22] = "UNUSED_VALUE_WITHOUT_DROP", e[e.INVALID_PUBLIC_FUNCTION_RETURN_TYPE = 23] = "INVALID_PUBLIC_FUNCTION_RETURN_TYPE", e[e.INVALID_TRANSFER_OBJECT = 24] = "INVALID_TRANSFER_OBJECT", e[e.EFFECTS_TOO_LARGE = 25] = "EFFECTS_TOO_LARGE", e[e.PUBLISH_UPGRADE_MISSING_DEPENDENCY = 26] = "PUBLISH_UPGRADE_MISSING_DEPENDENCY", e[e.PUBLISH_UPGRADE_DEPENDENCY_DOWNGRADE = 27] = "PUBLISH_UPGRADE_DEPENDENCY_DOWNGRADE", e[e.PACKAGE_UPGRADE_ERROR = 28] = "PACKAGE_UPGRADE_ERROR", e[e.WRITTEN_OBJECTS_TOO_LARGE = 29] = "WRITTEN_OBJECTS_TOO_LARGE", e[e.CERTIFICATE_DENIED = 30] = "CERTIFICATE_DENIED", e[e.SUI_MOVE_VERIFICATION_TIMEDOUT = 31] = "SUI_MOVE_VERIFICATION_TIMEDOUT", e[e.CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED = 32] = "CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED", e[e.INPUT_OBJECT_DELETED = 33] = "INPUT_OBJECT_DELETED", e[e.EXECUTION_CANCELED_DUE_TO_CONSENSUS_OBJECT_CONGESTION = 34] = "EXECUTION_CANCELED_DUE_TO_CONSENSUS_OBJECT_CONGESTION", e[e.ADDRESS_DENIED_FOR_COIN = 35] = "ADDRESS_DENIED_FOR_COIN", e[e.COIN_TYPE_GLOBAL_PAUSE = 36] = "COIN_TYPE_GLOBAL_PAUSE", e[e.EXECUTION_CANCELED_DUE_TO_RANDOMNESS_UNAVAILABLE = 37] = "EXECUTION_CANCELED_DUE_TO_RANDOMNESS_UNAVAILABLE", e[e.MOVE_VECTOR_ELEM_TOO_BIG = 38] = "MOVE_VECTOR_ELEM_TOO_BIG", e[e.MOVE_RAW_VALUE_TOO_BIG = 39] = "MOVE_RAW_VALUE_TOO_BIG", e[e.INVALID_LINKAGE = 40] = "INVALID_LINKAGE", e[e.INSUFFICIENT_FUNDS_FOR_WITHDRAW = 41] = "INSUFFICIENT_FUNDS_FOR_WITHDRAW", e[e.NON_EXCLUSIVE_WRITE_INPUT_OBJECT_MODIFIED = 42] = "NON_EXCLUSIVE_WRITE_INPUT_OBJECT_MODIFIED", e;
}({}), f8 = /* @__PURE__ */ function(e) {
  return e[e.COMMAND_ARGUMENT_ERROR_KIND_UNKNOWN = 0] = "COMMAND_ARGUMENT_ERROR_KIND_UNKNOWN", e[e.TYPE_MISMATCH = 1] = "TYPE_MISMATCH", e[e.INVALID_BCS_BYTES = 2] = "INVALID_BCS_BYTES", e[e.INVALID_USAGE_OF_PURE_ARGUMENT = 3] = "INVALID_USAGE_OF_PURE_ARGUMENT", e[e.INVALID_ARGUMENT_TO_PRIVATE_ENTRY_FUNCTION = 4] = "INVALID_ARGUMENT_TO_PRIVATE_ENTRY_FUNCTION", e[e.INDEX_OUT_OF_BOUNDS = 5] = "INDEX_OUT_OF_BOUNDS", e[e.SECONDARY_INDEX_OUT_OF_BOUNDS = 6] = "SECONDARY_INDEX_OUT_OF_BOUNDS", e[e.INVALID_RESULT_ARITY = 7] = "INVALID_RESULT_ARITY", e[e.INVALID_GAS_COIN_USAGE = 8] = "INVALID_GAS_COIN_USAGE", e[e.INVALID_VALUE_USAGE = 9] = "INVALID_VALUE_USAGE", e[e.INVALID_OBJECT_BY_VALUE = 10] = "INVALID_OBJECT_BY_VALUE", e[e.INVALID_OBJECT_BY_MUT_REF = 11] = "INVALID_OBJECT_BY_MUT_REF", e[e.CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED = 12] = "CONSENSUS_OBJECT_OPERATION_NOT_ALLOWED", e[e.INVALID_ARGUMENT_ARITY = 13] = "INVALID_ARGUMENT_ARITY", e[e.INVALID_TRANSFER_OBJECT = 14] = "INVALID_TRANSFER_OBJECT", e[e.INVALID_MAKE_MOVE_VEC_NON_OBJECT_ARGUMENT = 15] = "INVALID_MAKE_MOVE_VEC_NON_OBJECT_ARGUMENT", e[e.ARGUMENT_WITHOUT_VALUE = 16] = "ARGUMENT_WITHOUT_VALUE", e[e.CANNOT_MOVE_BORROWED_VALUE = 17] = "CANNOT_MOVE_BORROWED_VALUE", e[e.CANNOT_WRITE_TO_EXTENDED_REFERENCE = 18] = "CANNOT_WRITE_TO_EXTENDED_REFERENCE", e[e.INVALID_REFERENCE_ARGUMENT = 19] = "INVALID_REFERENCE_ARGUMENT", e;
}({}), u8 = /* @__PURE__ */ function(e) {
  return e[e.PACKAGE_UPGRADE_ERROR_KIND_UNKNOWN = 0] = "PACKAGE_UPGRADE_ERROR_KIND_UNKNOWN", e[e.UNABLE_TO_FETCH_PACKAGE = 1] = "UNABLE_TO_FETCH_PACKAGE", e[e.NOT_A_PACKAGE = 2] = "NOT_A_PACKAGE", e[e.INCOMPATIBLE_UPGRADE = 3] = "INCOMPATIBLE_UPGRADE", e[e.DIGEST_DOES_NOT_MATCH = 4] = "DIGEST_DOES_NOT_MATCH", e[e.UNKNOWN_UPGRADE_POLICY = 5] = "UNKNOWN_UPGRADE_POLICY", e[e.PACKAGE_ID_DOES_NOT_MATCH = 6] = "PACKAGE_ID_DOES_NOT_MATCH", e;
}({}), l8 = /* @__PURE__ */ function(e) {
  return e[e.TYPE_ARGUMENT_ERROR_KIND_UNKNOWN = 0] = "TYPE_ARGUMENT_ERROR_KIND_UNKNOWN", e[e.TYPE_NOT_FOUND = 1] = "TYPE_NOT_FOUND", e[e.CONSTRAINT_NOT_SATISFIED = 2] = "CONSTRAINT_NOT_SATISFIED", e;
}({});
var b8 = class extends N {
  constructor() {
    super("sui.rpc.v2.ExecutionStatus", [{
      no: 1,
      name: "success",
      kind: "scalar",
      opt: !0,
      T: 8
    }, {
      no: 2,
      name: "error",
      kind: "message",
      T: () => g8
    }]);
  }
};
const p8 = new b8();
var m8 = class extends N {
  constructor() {
    super("sui.rpc.v2.ExecutionError", [
      {
        no: 1,
        name: "description",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "command",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.ExecutionError.ExecutionErrorKind", d8]
      },
      {
        no: 4,
        name: "abort",
        kind: "message",
        oneof: "errorDetails",
        T: () => A8
      },
      {
        no: 5,
        name: "size_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => O8
      },
      {
        no: 6,
        name: "command_argument_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => _8
      },
      {
        no: 7,
        name: "type_argument_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => R8
      },
      {
        no: 8,
        name: "package_upgrade_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => j8
      },
      {
        no: 9,
        name: "index_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => Fo
      },
      {
        no: 10,
        name: "object_id",
        kind: "scalar",
        oneof: "errorDetails",
        T: 9
      },
      {
        no: 11,
        name: "coin_deny_list_error",
        kind: "message",
        oneof: "errorDetails",
        T: () => k8
      },
      {
        no: 12,
        name: "congested_objects",
        kind: "message",
        oneof: "errorDetails",
        T: () => C8
      }
    ]);
  }
};
const g8 = new m8();
var h8 = class extends N {
  constructor() {
    super("sui.rpc.v2.MoveAbort", [
      {
        no: 1,
        name: "abort_code",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "location",
        kind: "message",
        T: () => w8
      },
      {
        no: 3,
        name: "clever_error",
        kind: "message",
        T: () => v8
      }
    ]);
  }
};
const A8 = new h8();
var y8 = class extends N {
  constructor() {
    super("sui.rpc.v2.MoveLocation", [
      {
        no: 1,
        name: "package",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "module",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "function",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 4,
        name: "instruction",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 5,
        name: "function_name",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const w8 = new y8();
var T8 = class extends N {
  constructor() {
    super("sui.rpc.v2.CleverError", [
      {
        no: 1,
        name: "error_code",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "line_number",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 3,
        name: "constant_name",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "constant_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "rendered",
        kind: "scalar",
        oneof: "value",
        T: 9
      },
      {
        no: 6,
        name: "raw",
        kind: "scalar",
        oneof: "value",
        T: 12
      }
    ]);
  }
};
const v8 = new T8();
var I8 = class extends N {
  constructor() {
    super("sui.rpc.v2.SizeError", [{
      no: 1,
      name: "size",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }, {
      no: 2,
      name: "max_size",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }]);
  }
};
const O8 = new I8();
var E8 = class extends N {
  constructor() {
    super("sui.rpc.v2.IndexError", [{
      no: 1,
      name: "index",
      kind: "scalar",
      opt: !0,
      T: 13
    }, {
      no: 2,
      name: "subresult",
      kind: "scalar",
      opt: !0,
      T: 13
    }]);
  }
};
const Fo = new E8();
var S8 = class extends N {
  constructor() {
    super("sui.rpc.v2.CoinDenyListError", [{
      no: 1,
      name: "address",
      kind: "scalar",
      opt: !0,
      T: 9
    }, {
      no: 2,
      name: "coin_type",
      kind: "scalar",
      opt: !0,
      T: 9
    }]);
  }
};
const k8 = new S8();
var N8 = class extends N {
  constructor() {
    super("sui.rpc.v2.CongestedObjects", [{
      no: 1,
      name: "objects",
      kind: "scalar",
      repeat: 2,
      T: 9
    }]);
  }
};
const C8 = new N8();
var x8 = class extends N {
  constructor() {
    super("sui.rpc.v2.CommandArgumentError", [
      {
        no: 1,
        name: "argument",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 2,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.CommandArgumentError.CommandArgumentErrorKind", f8]
      },
      {
        no: 3,
        name: "index_error",
        kind: "message",
        T: () => Fo
      }
    ]);
  }
};
const _8 = new x8();
var B8 = class extends N {
  constructor() {
    super("sui.rpc.v2.PackageUpgradeError", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.PackageUpgradeError.PackageUpgradeErrorKind", u8]
      },
      {
        no: 2,
        name: "package_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 4,
        name: "policy",
        kind: "scalar",
        opt: !0,
        T: 13
      },
      {
        no: 5,
        name: "ticket_id",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const j8 = new B8();
var M8 = class extends N {
  constructor() {
    super("sui.rpc.v2.TypeArgumentError", [{
      no: 1,
      name: "type_argument",
      kind: "scalar",
      opt: !0,
      T: 13
    }, {
      no: 2,
      name: "kind",
      kind: "enum",
      opt: !0,
      T: () => ["sui.rpc.v2.TypeArgumentError.TypeArgumentErrorKind", l8]
    }]);
  }
};
const R8 = new M8();
let D8 = /* @__PURE__ */ function(e) {
  return e[e.UNKNOWN = 0] = "UNKNOWN", e[e.DOES_NOT_EXIST = 1] = "DOES_NOT_EXIST", e[e.EXISTS = 2] = "EXISTS", e;
}({}), U8 = /* @__PURE__ */ function(e) {
  return e[e.UNKNOWN = 0] = "UNKNOWN", e[e.DOES_NOT_EXIST = 1] = "DOES_NOT_EXIST", e[e.OBJECT_WRITE = 2] = "OBJECT_WRITE", e[e.PACKAGE_WRITE = 3] = "PACKAGE_WRITE", e[e.ACCUMULATOR_WRITE = 4] = "ACCUMULATOR_WRITE", e;
}({}), P8 = /* @__PURE__ */ function(e) {
  return e[e.ID_OPERATION_UNKNOWN = 0] = "ID_OPERATION_UNKNOWN", e[e.NONE = 1] = "NONE", e[e.CREATED = 2] = "CREATED", e[e.DELETED = 3] = "DELETED", e;
}({}), V8 = /* @__PURE__ */ function(e) {
  return e[e.ACCUMULATOR_OPERATION_UNKNOWN = 0] = "ACCUMULATOR_OPERATION_UNKNOWN", e[e.MERGE = 1] = "MERGE", e[e.SPLIT = 2] = "SPLIT", e;
}({}), F8 = /* @__PURE__ */ function(e) {
  return e[e.ACCUMULATOR_VALUE_UNKNOWN = 0] = "ACCUMULATOR_VALUE_UNKNOWN", e[e.INTEGER = 1] = "INTEGER", e[e.INTEGER_TUPLE = 2] = "INTEGER_TUPLE", e[e.EVENT_DIGEST = 3] = "EVENT_DIGEST", e;
}({}), $8 = /* @__PURE__ */ function(e) {
  return e[e.UNCHANGED_CONSENSUS_OBJECT_KIND_UNKNOWN = 0] = "UNCHANGED_CONSENSUS_OBJECT_KIND_UNKNOWN", e[e.READ_ONLY_ROOT = 1] = "READ_ONLY_ROOT", e[e.MUTATE_CONSENSUS_STREAM_ENDED = 2] = "MUTATE_CONSENSUS_STREAM_ENDED", e[e.READ_CONSENSUS_STREAM_ENDED = 3] = "READ_CONSENSUS_STREAM_ENDED", e[e.CANCELED = 4] = "CANCELED", e[e.PER_EPOCH_CONFIG = 5] = "PER_EPOCH_CONFIG", e;
}({});
var L8 = class extends N {
  constructor() {
    super("sui.rpc.v2.TransactionEffects", [
      {
        no: 1,
        name: "bcs",
        kind: "message",
        T: () => ra
      },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 5
      },
      {
        no: 4,
        name: "status",
        kind: "message",
        T: () => p8
      },
      {
        no: 5,
        name: "epoch",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "gas_used",
        kind: "message",
        T: () => o8
      },
      {
        no: 7,
        name: "transaction_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 8,
        name: "gas_object",
        kind: "message",
        T: () => Xr
      },
      {
        no: 9,
        name: "events_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 10,
        name: "dependencies",
        kind: "scalar",
        repeat: 2,
        T: 9
      },
      {
        no: 11,
        name: "lamport_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 12,
        name: "changed_objects",
        kind: "message",
        repeat: 2,
        T: () => Xr
      },
      {
        no: 13,
        name: "unchanged_consensus_objects",
        kind: "message",
        repeat: 2,
        T: () => H8
      },
      {
        no: 14,
        name: "auxiliary_data_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 15,
        name: "unchanged_loaded_runtime_objects",
        kind: "message",
        repeat: 2,
        T: () => Do
      }
    ]);
  }
};
const z8 = new L8();
var G8 = class extends N {
  constructor() {
    super("sui.rpc.v2.ChangedObject", [
      {
        no: 1,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "input_state",
        kind: "enum",
        opt: !0,
        T: () => [
          "sui.rpc.v2.ChangedObject.InputObjectState",
          D8,
          "INPUT_OBJECT_STATE_"
        ]
      },
      {
        no: 3,
        name: "input_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "input_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "input_owner",
        kind: "message",
        T: () => gs
      },
      {
        no: 6,
        name: "output_state",
        kind: "enum",
        opt: !0,
        T: () => [
          "sui.rpc.v2.ChangedObject.OutputObjectState",
          U8,
          "OUTPUT_OBJECT_STATE_"
        ]
      },
      {
        no: 7,
        name: "output_version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 8,
        name: "output_digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 9,
        name: "output_owner",
        kind: "message",
        T: () => gs
      },
      {
        no: 12,
        name: "accumulator_write",
        kind: "message",
        T: () => Y8
      },
      {
        no: 10,
        name: "id_operation",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.ChangedObject.IdOperation", P8]
      },
      {
        no: 11,
        name: "object_type",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const Xr = new G8();
var W8 = class extends N {
  constructor() {
    super("sui.rpc.v2.EventDigestEntry", [{
      no: 1,
      name: "event_index",
      kind: "scalar",
      opt: !0,
      T: 4,
      L: 0
    }, {
      no: 2,
      name: "digest",
      kind: "scalar",
      opt: !0,
      T: 9
    }]);
  }
};
const Q8 = new W8();
var J8 = class extends N {
  constructor() {
    super("sui.rpc.v2.AccumulatorWrite", [
      {
        no: 1,
        name: "address",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 2,
        name: "accumulator_type",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "operation",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.AccumulatorWrite.AccumulatorOperation", V8]
      },
      {
        no: 4,
        name: "value_kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.AccumulatorWrite.AccumulatorValue", F8]
      },
      {
        no: 5,
        name: "integer_value",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 6,
        name: "integer_tuple",
        kind: "scalar",
        repeat: 1,
        T: 4,
        L: 0
      },
      {
        no: 7,
        name: "event_digest_value",
        kind: "message",
        repeat: 2,
        T: () => Q8
      }
    ]);
  }
};
const Y8 = new J8();
var Z8 = class extends N {
  constructor() {
    super("sui.rpc.v2.UnchangedConsensusObject", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: !0,
        T: () => ["sui.rpc.v2.UnchangedConsensusObject.UnchangedConsensusObjectKind", $8]
      },
      {
        no: 2,
        name: "object_id",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: !0,
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "digest",
        kind: "scalar",
        opt: !0,
        T: 9
      },
      {
        no: 5,
        name: "object_type",
        kind: "scalar",
        opt: !0,
        T: 9
      }
    ]);
  }
};
const H8 = new Z8(), q8 = 50;
function Kr(e) {
  if (e.after != null && e.before != null) throw new Error("Only one of `after` or `before` may be provided");
  const t = e.order ? e.order === "descending" : e.before != null;
  if (e.after != null && t) throw new Error("`after` can not be combined with descending queries");
  if (e.before != null && !t) throw new Error("`before` can not be combined with ascending queries");
  return {
    descending: t,
    after: e.after ?? void 0,
    before: e.before ?? void 0,
    limit: e.limit ?? q8
  };
}
function X8(e, t) {
  if ((e == null ? void 0 : e.$kind) === "function" && (t.after != null || t.before != null) && (!e.module || !e.function)) throw new Error("Paginating transactions filtered by function requires a fully qualified `package::module::function`");
}
async function K8(e, t, n) {
  if ($o(t, ["sender", "function"], "transaction"), t.sender != null) return {
    $kind: "sender",
    sender: H(t.sender)
  };
  const [a, s, r, ...i] = t.function.split("::");
  if (!a || i.length > 0 || s === "" || r === "") throw new Error(`Invalid function filter "${t.function}": expected "package", "package::module", or "package::module::function"`);
  return {
    $kind: "function",
    package: H((await e.resolvePackage({
      package: a,
      signal: n
    })).package),
    module: s,
    function: r
  };
}
async function ep(e, t, n) {
  if ($o(t, [
    "sender",
    "emitModule",
    "eventType"
  ], "event"), t.sender != null) return {
    $kind: "sender",
    sender: H(t.sender)
  };
  if (t.emitModule != null) {
    const [r, i, ...c] = t.emitModule.split("::");
    if (!r || !i || c.length > 0) throw new Error(`Invalid emitModule filter "${t.emitModule}": expected "package::module"`);
    return {
      $kind: "emitModule",
      package: H((await e.resolvePackage({
        package: r,
        signal: n
      })).package),
      module: i
    };
  }
  const a = t.eventType, s = a.split("::");
  if (s.length === 2 && s.every((r) => r !== "")) return {
    $kind: "eventTypeModule",
    package: H((await e.resolvePackage({
      package: s[0],
      signal: n
    })).package),
    module: s[1]
  };
  if (s.length < 3 || s.some((r) => r === "")) throw new Error(`Invalid eventType filter "${a}": expected "package::module" or a fully qualified type name`);
  return {
    $kind: "eventType",
    eventType: (await e.resolveType({
      type: a,
      signal: n
    })).type
  };
}
function $o(e, t, n) {
  const a = t.filter((s) => e[s] != null);
  if (a.length !== 1) throw new Error(`A ${n} filter must specify exactly one of ${t.join(", ")}${a.length ? ` (got ${a.join(", ")})` : ""}`);
}
var Oe, j0, U0, Ai, tp = (Ai = class extends yl {
  constructor({ graphqlClient: t, mvr: n }) {
    super({
      network: t.network,
      base: t,
      mvr: n
    });
    o0(this, j0);
    o0(this, Oe);
    W(this, Oe, t);
  }
  async getObjects(t) {
    var s, r, i, c, o;
    const n = Xn(t.objectIds, 50), a = [];
    for (const d of n) {
      const u = await Y(this, j0, U0).call(this, {
        query: ul,
        signal: t.signal,
        variables: {
          objectKeys: d.map((l) => ({ address: l })),
          includeContent: ((s = t.include) == null ? void 0 : s.content) ?? !1,
          includePreviousTransaction: ((r = t.include) == null ? void 0 : r.previousTransaction) ?? !1,
          includeObjectBcs: ((i = t.include) == null ? void 0 : i.objectBcs) ?? !1,
          includeJson: ((c = t.include) == null ? void 0 : c.json) ?? !1,
          includeDisplay: ((o = t.include) == null ? void 0 : o.display) ?? !1
        }
      }, (l) => l.multiGetObjects);
      a.push(...d.map((l) => ({
        objectId: l,
        normalized: H(l)
      })).map(({ objectId: l, normalized: b }) => u.find((p) => (p == null ? void 0 : p.address) === b) ?? new Br("notFound", `Object ${b} not found`, {
        reason: "notFound",
        objectId: l
      })).map((l) => {
        var w, I, C, R, F, j, D, P, O, Q, $, v, q;
        if (l instanceof Br) return l;
        const b = (I = (w = l.asMoveObject) == null ? void 0 : w.contents) != null && I.bcs ? z0(l.asMoveObject.contents.bcs) : void 0, p = l.objectBcs ? z0(l.objectBcs) : void 0;
        let m;
        l.asMovePackage ? m = "package" : (F = (R = (C = l.asMoveObject) == null ? void 0 : C.contents) == null ? void 0 : R.type) != null && F.repr ? m = l.asMoveObject.contents.type.repr : m = "";
        const h = (j = t.include) != null && j.json ? (P = (D = l.asMoveObject) == null ? void 0 : D.contents) != null && P.json ? l.asMoveObject.contents.json : null : void 0, y = ei((O = t.include) == null ? void 0 : O.display, ($ = (Q = l.asMoveObject) == null ? void 0 : Q.contents) == null ? void 0 : $.display);
        return {
          objectId: l.address,
          version: (v = l.version) == null ? void 0 : v.toString(),
          digest: l.digest,
          owner: Fa(l.owner),
          type: m,
          content: b,
          previousTransaction: ((q = l.previousTransaction) == null ? void 0 : q.digest) ?? void 0,
          objectBcs: p,
          json: h,
          display: y
        };
      }));
    }
    return { objects: a };
  }
  async listOwnedObjects(t) {
    var a, s, r, i, c;
    const n = await Y(this, j0, U0).call(this, {
      query: fl,
      signal: t.signal,
      variables: {
        owner: t.owner,
        limit: t.limit,
        cursor: t.cursor,
        filter: t.type ? { type: (await this.mvr.resolveType({
          type: t.type,
          signal: t.signal
        })).type } : void 0,
        includeContent: ((a = t.include) == null ? void 0 : a.content) ?? !1,
        includePreviousTransaction: ((s = t.include) == null ? void 0 : s.previousTransaction) ?? !1,
        includeObjectBcs: ((r = t.include) == null ? void 0 : r.objectBcs) ?? !1,
        includeJson: ((i = t.include) == null ? void 0 : i.json) ?? !1,
        includeDisplay: ((c = t.include) == null ? void 0 : c.display) ?? !1
      }
    }, (o) => {
      var d;
      return (d = o.address) == null ? void 0 : d.objects;
    });
    return {
      objects: n.nodes.map((o) => {
        var d, u, l, b, p, m, h, y, w;
        return {
          objectId: o.address,
          version: (d = o.version) == null ? void 0 : d.toString(),
          digest: o.digest,
          owner: Fa(o.owner),
          type: (l = (u = o.contents) == null ? void 0 : u.type) == null ? void 0 : l.repr,
          content: (b = o.contents) != null && b.bcs ? z0(o.contents.bcs) : void 0,
          previousTransaction: ((p = o.previousTransaction) == null ? void 0 : p.digest) ?? void 0,
          objectBcs: o.objectBcs ? z0(o.objectBcs) : void 0,
          json: (m = t.include) != null && m.json ? (h = o.contents) != null && h.json ? o.contents.json : null : void 0,
          display: ei((y = t.include) == null ? void 0 : y.display, (w = o.contents) == null ? void 0 : w.display)
        };
      }),
      hasNextPage: n.pageInfo.hasNextPage,
      cursor: n.pageInfo.endCursor ?? null
    };
  }
  async listCoins(t) {
    const n = t.coinType ?? qn, a = await Y(this, j0, U0).call(this, {
      query: tl,
      signal: t.signal,
      variables: {
        owner: t.owner,
        cursor: t.cursor,
        first: t.limit,
        type: `0x2::coin::Coin<${(await this.mvr.resolveType({
          type: n,
          signal: t.signal
        })).type}>`
      }
    }, (s) => {
      var r;
      return (r = s.address) == null ? void 0 : r.objects;
    });
    return {
      cursor: a.pageInfo.endCursor ?? null,
      hasNextPage: a.pageInfo.hasNextPage,
      objects: a.nodes.map((s) => {
        var r, i, c, o, d;
        return {
          objectId: s.address,
          version: (r = s.version) == null ? void 0 : r.toString(),
          digest: s.digest,
          owner: Fa(s.owner),
          type: (c = (i = s.contents) == null ? void 0 : i.type) == null ? void 0 : c.repr,
          balance: (d = (o = s.contents) == null ? void 0 : o.json) == null ? void 0 : d.balance
        };
      })
    };
  }
  async getBalance(t) {
    var i;
    const n = t.coinType ?? qn, a = await Y(this, j0, U0).call(this, {
      query: Xu,
      signal: t.signal,
      variables: {
        owner: t.owner,
        coinType: (await this.mvr.resolveType({
          type: n,
          signal: t.signal
        })).type
      }
    }, (c) => {
      var o;
      return (o = c.address) == null ? void 0 : o.balance;
    }), s = BigInt(a.addressBalance ?? "0"), r = BigInt(a.totalBalance ?? "0") - s;
    return { balance: {
      coinType: ((i = a.coinType) == null ? void 0 : i.repr) ?? n,
      balance: a.totalBalance ?? "0",
      coinBalance: r.toString(),
      addressBalance: s.toString()
    } };
  }
  async getCoinMetadata(t) {
    const n = (await this.mvr.resolveType({
      type: t.coinType,
      signal: t.signal
    })).type, { data: a, errors: s } = await g(this, Oe).query({
      query: el,
      signal: t.signal,
      variables: { coinType: n }
    });
    return Nn(s), a != null && a.coinMetadata ? { coinMetadata: {
      id: a.coinMetadata.address,
      decimals: a.coinMetadata.decimals,
      name: a.coinMetadata.name,
      symbol: a.coinMetadata.symbol,
      description: a.coinMetadata.description,
      iconUrl: a.coinMetadata.iconUrl ?? null
    } } : { coinMetadata: null };
  }
  async listBalances(t) {
    const n = await Y(this, j0, U0).call(this, {
      query: qu,
      signal: t.signal,
      variables: {
        owner: t.owner,
        limit: t.limit,
        cursor: t.cursor
      }
    }, (a) => {
      var s;
      return (s = a.address) == null ? void 0 : s.balances;
    });
    return {
      cursor: n.pageInfo.endCursor ?? null,
      hasNextPage: n.pageInfo.hasNextPage,
      balances: n.nodes.map((a) => {
        var i;
        const s = BigInt(a.addressBalance ?? "0"), r = BigInt(a.totalBalance ?? "0") - s;
        return {
          coinType: (i = a.coinType) == null ? void 0 : i.repr,
          balance: a.totalBalance,
          coinBalance: r.toString(),
          addressBalance: s.toString()
        };
      })
    };
  }
  async getTransaction(t) {
    var n, a, s, r, i, c;
    return Cn(await Y(this, j0, U0).call(this, {
      query: pl,
      signal: t.signal,
      variables: {
        digest: t.digest,
        includeTransaction: ((n = t.include) == null ? void 0 : n.transaction) ?? !1,
        includeEffects: ((a = t.include) == null ? void 0 : a.effects) ?? !1,
        includeEvents: ((s = t.include) == null ? void 0 : s.events) ?? !1,
        includeBalanceChanges: ((r = t.include) == null ? void 0 : r.balanceChanges) ?? !1,
        includeObjectTypes: ((i = t.include) == null ? void 0 : i.objectTypes) ?? !1,
        includeBcs: ((c = t.include) == null ? void 0 : c.bcs) ?? !1
      }
    }, (o) => o.transaction, () => new cu("notFound", t.digest)), t.include);
  }
  async executeTransaction(t) {
    var n, a, s, r, i, c, o;
    return Cn((o = (await Y(this, j0, U0).call(this, {
      query: bl,
      signal: t.signal,
      variables: {
        transactionDataBcs: cs(t.transaction),
        signatures: t.signatures,
        includeTransaction: ((n = t.include) == null ? void 0 : n.transaction) ?? !1,
        includeEffects: ((a = t.include) == null ? void 0 : a.effects) ?? !1,
        includeEvents: ((s = t.include) == null ? void 0 : s.events) ?? !1,
        includeBalanceChanges: ((r = t.include) == null ? void 0 : r.balanceChanges) ?? !1,
        includeObjectTypes: ((i = t.include) == null ? void 0 : i.objectTypes) ?? !1,
        includeBcs: ((c = t.include) == null ? void 0 : c.bcs) ?? !1
      }
    }, (d) => d.executeTransaction)).effects) == null ? void 0 : o.transaction, t.include);
  }
  async simulateTransaction(t) {
    var i, c, o, d, u, l, b, p, m, h;
    t.transaction instanceof Uint8Array || await t.transaction.prepareForSerialization({ client: this });
    const n = t.doGasSelection ?? (t.transaction instanceof Uint8Array ? El(t.transaction) : ((i = t.transaction.getData().gasData.payment) == null ? void 0 : i.length) === 0), a = await Y(this, j0, U0).call(this, {
      query: ll,
      signal: t.signal,
      variables: {
        transaction: t.transaction instanceof Uint8Array ? { bcs: { value: cs(t.transaction) } } : e8(t.transaction),
        includeTransaction: ((c = t.include) == null ? void 0 : c.transaction) ?? !1,
        includeEffects: ((o = t.include) == null ? void 0 : o.effects) ?? !1,
        includeEvents: ((d = t.include) == null ? void 0 : d.events) ?? !1,
        includeBalanceChanges: ((u = t.include) == null ? void 0 : u.balanceChanges) ?? !1,
        includeObjectTypes: ((l = t.include) == null ? void 0 : l.objectTypes) ?? !1,
        includeCommandResults: ((b = t.include) == null ? void 0 : b.commandResults) ?? !1,
        includeBcs: ((p = t.include) == null ? void 0 : p.bcs) ?? !1,
        doGasSelection: n,
        checksEnabled: t.checksEnabled ?? !0
      }
    }, (y) => y.simulateTransaction), s = Cn((m = a.effects) == null ? void 0 : m.transaction, t.include), r = (h = t.include) != null && h.commandResults && a.outputs ? a.outputs.map((y) => ({
      returnValues: (y.returnValues ?? []).map((w) => {
        var I;
        return { bcs: (I = w.value) != null && I.bcs ? z0(w.value.bcs) : null };
      }),
      mutatedReferences: (y.mutatedReferences ?? []).map((w) => {
        var I;
        return { bcs: (I = w.value) != null && I.bcs ? z0(w.value.bcs) : null };
      })
    })) : void 0;
    return s.$kind === "Transaction" ? {
      $kind: "Transaction",
      Transaction: s.Transaction,
      commandResults: r
    } : {
      $kind: "FailedTransaction",
      FailedTransaction: s.FailedTransaction,
      commandResults: r
    };
  }
  async getReferenceGasPrice(t) {
    return { referenceGasPrice: await Y(this, j0, U0).call(this, {
      query: il,
      signal: t == null ? void 0 : t.signal
    }, (n) => {
      var a;
      return (a = n.epoch) == null ? void 0 : a.referenceGasPrice;
    }) ?? "" };
  }
  async getProtocolConfig(t) {
    var r;
    const n = await Y(this, j0, U0).call(this, {
      query: rl,
      signal: t == null ? void 0 : t.signal
    }, (i) => {
      var c;
      return (c = i.epoch) == null ? void 0 : c.protocolConfigs;
    }), a = {};
    for (const i of (n == null ? void 0 : n.featureFlags) ?? []) a[i.key] = i.value;
    const s = {};
    for (const i of (n == null ? void 0 : n.configs) ?? []) s[i.key] = i.value ?? null;
    return { protocolConfig: {
      protocolVersion: ((r = n == null ? void 0 : n.protocolVersion) == null ? void 0 : r.toString()) ?? null,
      featureFlags: a,
      attributes: s
    } };
  }
  async getCurrentSystemState(t) {
    var r, i, c, o, d, u, l, b, p, m, h, y, w, I, C, R, F, j, D, P, O, Q, $, v, q, b0, x, G, E;
    const n = await Y(this, j0, U0).call(this, {
      query: nl,
      signal: t == null ? void 0 : t.signal
    }, (p0) => p0.epoch);
    if (!n) throw new Error("Epoch data not found in response");
    const a = n.startTimestamp ? new Date(n.startTimestamp).getTime().toString() : null, s = (r = n.systemState) == null ? void 0 : r.json;
    return { systemState: {
      systemStateVersion: ((i = s == null ? void 0 : s.system_state_version) == null ? void 0 : i.toString()) ?? null,
      epoch: ((c = n.epochId) == null ? void 0 : c.toString()) ?? null,
      protocolVersion: ((d = (o = n.protocolConfigs) == null ? void 0 : o.protocolVersion) == null ? void 0 : d.toString()) ?? null,
      referenceGasPrice: n.referenceGasPrice ?? null,
      epochStartTimestampMs: a,
      safeMode: (s == null ? void 0 : s.safe_mode) ?? !1,
      safeModeStorageRewards: (s == null ? void 0 : s.safe_mode_storage_rewards) ?? null,
      safeModeComputationRewards: (s == null ? void 0 : s.safe_mode_computation_rewards) ?? null,
      safeModeStorageRebates: ((u = s == null ? void 0 : s.safe_mode_storage_rebates) == null ? void 0 : u.toString()) ?? null,
      safeModeNonRefundableStorageFee: ((l = s == null ? void 0 : s.safe_mode_non_refundable_storage_fee) == null ? void 0 : l.toString()) ?? null,
      parameters: {
        epochDurationMs: ((p = (b = s == null ? void 0 : s.parameters) == null ? void 0 : b.epoch_duration_ms) == null ? void 0 : p.toString()) ?? null,
        stakeSubsidyStartEpoch: ((h = (m = s == null ? void 0 : s.parameters) == null ? void 0 : m.stake_subsidy_start_epoch) == null ? void 0 : h.toString()) ?? null,
        maxValidatorCount: ((w = (y = s == null ? void 0 : s.parameters) == null ? void 0 : y.max_validator_count) == null ? void 0 : w.toString()) ?? null,
        minValidatorJoiningStake: ((C = (I = s == null ? void 0 : s.parameters) == null ? void 0 : I.min_validator_joining_stake) == null ? void 0 : C.toString()) ?? null,
        validatorLowStakeThreshold: ((F = (R = s == null ? void 0 : s.parameters) == null ? void 0 : R.validator_low_stake_threshold) == null ? void 0 : F.toString()) ?? null,
        validatorLowStakeGracePeriod: ((D = (j = s == null ? void 0 : s.parameters) == null ? void 0 : j.validator_low_stake_grace_period) == null ? void 0 : D.toString()) ?? null
      },
      storageFund: {
        totalObjectStorageRebates: ((P = s == null ? void 0 : s.storage_fund) == null ? void 0 : P.total_object_storage_rebates) ?? null,
        nonRefundableBalance: ((O = s == null ? void 0 : s.storage_fund) == null ? void 0 : O.non_refundable_balance) ?? null
      },
      stakeSubsidy: {
        balance: ((Q = s == null ? void 0 : s.stake_subsidy) == null ? void 0 : Q.balance) ?? null,
        distributionCounter: ((v = ($ = s == null ? void 0 : s.stake_subsidy) == null ? void 0 : $.distribution_counter) == null ? void 0 : v.toString()) ?? null,
        currentDistributionAmount: ((b0 = (q = s == null ? void 0 : s.stake_subsidy) == null ? void 0 : q.current_distribution_amount) == null ? void 0 : b0.toString()) ?? null,
        stakeSubsidyPeriodLength: ((G = (x = s == null ? void 0 : s.stake_subsidy) == null ? void 0 : x.stake_subsidy_period_length) == null ? void 0 : G.toString()) ?? null,
        stakeSubsidyDecreaseRate: ((E = s == null ? void 0 : s.stake_subsidy) == null ? void 0 : E.stake_subsidy_decrease_rate) ?? null
      }
    } };
  }
  async listDynamicFields(t) {
    return g(this, Oe).listDynamicFields(t);
  }
  async listTransactions(t) {
    var d, u, l, b, p, m;
    const n = Kr(t), { descending: a, after: s, before: r, limit: i } = n, c = t.filter ? await K8(this.mvr, t.filter, t.signal) : void 0;
    X8(c, n);
    const o = await Y(this, j0, U0).call(this, {
      query: ml,
      signal: t.signal,
      variables: {
        filter: c && {
          sentAddress: c.$kind === "sender" ? c.sender : void 0,
          function: c.$kind === "function" ? [
            c.package,
            c.module,
            c.function
          ].filter(Boolean).join("::") : void 0
        },
        first: a ? void 0 : i,
        after: s,
        last: a ? i : void 0,
        before: r,
        includeTransaction: ((d = t.include) == null ? void 0 : d.transaction) ?? !1,
        includeEffects: ((u = t.include) == null ? void 0 : u.effects) ?? !1,
        includeEvents: ((l = t.include) == null ? void 0 : l.events) ?? !1,
        includeBalanceChanges: ((b = t.include) == null ? void 0 : b.balanceChanges) ?? !1,
        includeObjectTypes: ((p = t.include) == null ? void 0 : p.objectTypes) ?? !1,
        includeBcs: ((m = t.include) == null ? void 0 : m.bcs) ?? !1
      }
    }, (h) => h.transactions);
    return {
      transactions: (a ? [...o.nodes].reverse() : o.nodes).map((h) => Cn(h, t.include)),
      hasNextPage: a ? o.pageInfo.hasPreviousPage : o.pageInfo.hasNextPage,
      startCursor: (a ? o.pageInfo.endCursor : o.pageInfo.startCursor) ?? null,
      endCursor: (a ? o.pageInfo.startCursor : o.pageInfo.endCursor) ?? null
    };
  }
  async listEvents(t) {
    const { descending: n, after: a, before: s, limit: r } = Kr(t), i = t.filter ? await ep(this.mvr, t.filter, t.signal) : void 0, c = await Y(this, j0, U0).call(this, {
      query: cl,
      signal: t.signal,
      variables: {
        filter: i && {
          sender: i.$kind === "sender" ? i.sender : void 0,
          module: i.$kind === "emitModule" ? `${i.package}::${i.module}` : void 0,
          type: i.$kind === "eventTypeModule" ? `${i.package}::${i.module}` : i.$kind === "eventType" ? i.eventType : void 0
        },
        first: n ? void 0 : r,
        after: a,
        last: n ? r : void 0,
        before: s
      }
    }, (o) => o.events);
    return {
      events: (n ? [...c.nodes].reverse() : c.nodes).map((o) => {
        var m, h, y, w, I, C, R, F, j, D, P, O, Q;
        const d = (h = (m = o.transactionModule) == null ? void 0 : m.package) == null ? void 0 : h.address, u = (y = o.transactionModule) == null ? void 0 : y.name, l = (w = o.sender) == null ? void 0 : w.address, b = (C = (I = o.contents) == null ? void 0 : I.type) == null ? void 0 : C.repr, p = (R = o.transaction) == null ? void 0 : R.digest;
        if (!d || !u || !l || !b || !p) throw new Error("listEvents response is missing expected event fields");
        return {
          packageId: H(d),
          module: u,
          sender: H(l),
          eventType: ye(b),
          bcs: (F = o.contents) != null && F.bcs ? z0(o.contents.bcs) : new Uint8Array(),
          json: ((j = o.contents) == null ? void 0 : j.json) ?? null,
          checkpoint: ((Q = (O = (P = (D = o.transaction) == null ? void 0 : D.effects) == null ? void 0 : P.checkpoint) == null ? void 0 : O.sequenceNumber) == null ? void 0 : Q.toString()) ?? null,
          transactionDigest: p,
          eventIndex: o.sequenceNumber
        };
      }),
      hasNextPage: n ? c.pageInfo.hasPreviousPage : c.pageInfo.hasNextPage,
      startCursor: (n ? c.pageInfo.endCursor : c.pageInfo.startCursor) ?? null,
      endCursor: (n ? c.pageInfo.startCursor : c.pageInfo.endCursor) ?? null
    };
  }
  async verifyZkLoginSignature(t) {
    var s;
    const n = t.intentScope === "TransactionData" ? Ur.TransactionData : Ur.PersonalMessage, { data: a } = await g(this, Oe).query({
      query: hl,
      signal: t.signal,
      variables: {
        bytes: t.bytes,
        signature: t.signature,
        intentScope: n,
        author: t.address
      }
    });
    return {
      success: ((s = a == null ? void 0 : a.verifyZkLoginSignature) == null ? void 0 : s.success) ?? !1,
      errors: []
    };
  }
  async defaultNameServiceName(t) {
    return { data: { name: await Y(this, j0, U0).call(this, {
      query: ol,
      signal: t.signal,
      variables: { address: t.address }
    }, (n) => {
      var a, s;
      return ((s = (a = n.address) == null ? void 0 : a.defaultNameRecord) == null ? void 0 : s.domain) ?? null;
    }) } };
  }
  async resolveNameServiceAddress(t) {
    var s;
    const { data: n, errors: a } = await g(this, Oe).query({
      query: dl,
      signal: t.signal,
      variables: { name: t.name }
    });
    return Nn(a), { address: ((s = n == null ? void 0 : n.address) == null ? void 0 : s.address) ?? null };
  }
  async getMoveFunction(t) {
    var s, r, i;
    const n = await Y(this, j0, U0).call(this, {
      query: sl,
      signal: t.signal,
      variables: {
        package: (await this.mvr.resolvePackage({
          package: t.packageId,
          signal: t.signal
        })).package,
        module: t.moduleName,
        function: t.name
      }
    }, (c) => {
      var o, d;
      return (d = (o = c.package) == null ? void 0 : o.module) == null ? void 0 : d.function;
    });
    let a = "unknown";
    switch (n.visibility) {
      case "PUBLIC":
        a = "public";
        break;
      case "PRIVATE":
        a = "private";
        break;
      case "FRIEND":
        a = "friend";
        break;
    }
    return { function: {
      packageId: H(t.packageId),
      moduleName: t.moduleName,
      name: n.name,
      visibility: a,
      isEntry: n.isEntry ?? !1,
      typeParameters: ((s = n.typeParameters) == null ? void 0 : s.map(({ constraints: c }) => ({
        isPhantom: !1,
        constraints: c.map((o) => {
          switch (o) {
            case "COPY":
              return "copy";
            case "DROP":
              return "drop";
            case "STORE":
              return "store";
            case "KEY":
              return "key";
            default:
              return "unknown";
          }
        }) ?? []
      }))) ?? [],
      parameters: ((r = n.parameters) == null ? void 0 : r.map((c) => ti(c.signature))) ?? [],
      returns: ((i = n.return) == null ? void 0 : i.map(({ signature: c }) => ti(c))) ?? []
    } };
  }
  async getChainIdentifier(t) {
    const n = this.cache.read(["chainIdentifier"], async () => {
      const a = await Y(this, j0, U0).call(this, { query: Ku }, (s) => s.checkpoint);
      if (!(a != null && a.digest)) throw new Error("Genesis checkpoint digest not found");
      return { chainIdentifier: a.digest };
    });
    return Un(Promise.resolve(n), t == null ? void 0 : t.signal);
  }
  resolveTransactionPlugin() {
    const t = g(this, Oe);
    return async function(a, s, r) {
      var h, y, w, I, C, R, F;
      const i = a.snapshot();
      i.sender || (i.sender = "0x0000000000000000000000000000000000000000000000000000000000000000");
      const c = Vo(i), o = Ls.toJson(c), d = !s.onlyTransactionKind && (i.gasData.budget == null || i.gasData.payment == null), { data: u, errors: l } = await t.query({
        query: gl,
        variables: {
          transaction: o,
          doGasSelection: d,
          checksEnabled: !s.onlyTransactionKind
        }
      });
      Nn(l);
      const b = (w = (y = (h = u == null ? void 0 : u.simulateTransaction) == null ? void 0 : h.effects) == null ? void 0 : y.transaction) == null ? void 0 : w.effects;
      if (!s.onlyTransactionKind && (b == null ? void 0 : b.status) === vo.Failure) {
        const j = Lo(b.executionError);
        throw new fo(`Transaction resolution failed: ${(j == null ? void 0 : j.message) ?? "Transaction failed"}`, { executionError: j });
      }
      const p = (R = (C = (I = u == null ? void 0 : u.simulateTransaction) == null ? void 0 : I.effects) == null ? void 0 : C.transaction) == null ? void 0 : R.transactionBcs;
      if (!p) throw new Error("simulateTransaction did not return resolved transaction data");
      const m = _t.fromBytes(z0(p)).snapshot();
      return s.onlyTransactionKind ? a.applyResolvedData({
        ...m,
        sender: null,
        gasData: {
          budget: null,
          owner: null,
          payment: null,
          price: null
        },
        expiration: null
      }) : a.applyResolvedData(m), await s8({
        transactionData: a,
        client: t,
        epoch: (F = b == null ? void 0 : b.epoch) == null ? void 0 : F.epochId,
        originalTransactionData: i,
        isTransactionKindOnly: !!s.onlyTransactionKind,
        doGasSelection: d
      }), await r();
    };
  }
}, Oe = new WeakMap(), j0 = new WeakSet(), U0 = async function(t, n, a) {
  const { data: s, errors: r } = await g(this, Oe).query(t);
  Nn(r);
  const i = s && (n ? n(s) : s);
  if (i == null) throw (a == null ? void 0 : a()) ?? /* @__PURE__ */ new Error("Missing response data");
  return i;
}, Ai);
function ei(e, t) {
  if (e)
    return t ? {
      output: t.output ?? null,
      errors: t.errors ?? null
    } : null;
}
function Nn(e) {
  if (!e || e.length === 0) return;
  const t = e.map((n) => new np(n));
  throw t.length === 1 ? t[0] : new AggregateError(t);
}
var np = class extends Error {
  constructor(e) {
    super(e.message), this.locations = e.locations;
  }
};
function Fa(e) {
  var t, n, a;
  switch (e.__typename) {
    case "AddressOwner":
      return {
        $kind: "AddressOwner",
        AddressOwner: (t = e.address) == null ? void 0 : t.address
      };
    case "ConsensusAddressOwner":
      return {
        $kind: "ConsensusAddressOwner",
        ConsensusAddressOwner: {
          owner: (n = e == null ? void 0 : e.address) == null ? void 0 : n.address,
          startVersion: String(e.startVersion)
        }
      };
    case "ObjectOwner":
      return {
        $kind: "ObjectOwner",
        ObjectOwner: (a = e.address) == null ? void 0 : a.address
      };
    case "Immutable":
      return {
        $kind: "Immutable",
        Immutable: !0
      };
    case "Shared":
      return {
        $kind: "Shared",
        Shared: { initialSharedVersion: String(e.initialSharedVersion) }
      };
  }
}
function Cn(e, t) {
  var o, d, u, l, b, p, m, h, y, w, I, C, R, F, j, D, P;
  const n = {};
  if (t != null && t.objectTypes) {
    const O = (o = e.effects) == null ? void 0 : o.effectsJson;
    O && ((d = z8.fromJson(O).changedObjects) == null || d.forEach(($) => {
      $.objectId && $.objectType && (n[$.objectId] = $.objectType);
    }));
    const Q = (l = (u = e.effects) == null ? void 0 : u.objectChanges) == null ? void 0 : l.nodes;
    if (Q) for (const $ of Q) {
      const v = (h = (m = (p = (b = $.outputState) == null ? void 0 : b.asMoveObject) == null ? void 0 : p.contents) == null ? void 0 : m.type) == null ? void 0 : h.repr;
      $.address && v && (n[$.address] = v);
    }
  }
  let a;
  if (t != null && t.balanceChanges) {
    const O = (y = e.effects) == null ? void 0 : y.balanceChangesJson;
    Array.isArray(O) ? a = O.map((Q) => {
      const $ = i8.fromJson(Q);
      return {
        coinType: $.coinType,
        address: $.address,
        amount: $.amount
      };
    }) : a = [];
  }
  const s = ((w = e.effects) == null ? void 0 : w.status) === vo.Success ? {
    success: !0,
    error: null
  } : {
    success: !1,
    error: Lo((I = e.effects) == null ? void 0 : I.executionError)
  };
  let r;
  if (t != null && t.transaction && e.transactionJson) {
    const O = a8(Ls.fromJson(e.transactionJson));
    r = {
      gasData: O.gasData,
      sender: O.sender,
      expiration: O.expiration,
      commands: O.commands,
      inputs: O.inputs,
      version: O.version
    };
  }
  const i = t != null && t.bcs && e.transactionBcs ? z0(e.transactionBcs) : void 0, c = {
    digest: e.digest,
    status: s,
    effects: t != null && t.effects ? Sl(z0((C = e.effects) == null ? void 0 : C.effectsBcs)) : void 0,
    epoch: ((j = (F = (R = e.effects) == null ? void 0 : R.epoch) == null ? void 0 : F.epochId) == null ? void 0 : j.toString()) ?? null,
    objectTypes: t != null && t.objectTypes ? n : void 0,
    transaction: r,
    bcs: i,
    signatures: e.signatures.map((O) => O.signatureBytes),
    balanceChanges: a,
    events: t != null && t.events ? ((P = (D = e.effects) == null ? void 0 : D.events) == null ? void 0 : P.nodes.map((O) => {
      var q, b0, x, G, E;
      const Q = (b0 = (q = O.contents) == null ? void 0 : q.type) == null ? void 0 : b0.repr, [$, v] = Q.split("::");
      return {
        packageId: $,
        module: v,
        sender: (x = O.sender) == null ? void 0 : x.address,
        eventType: Q,
        bcs: (G = O.contents) != null && G.bcs ? z0(O.contents.bcs) : new Uint8Array(),
        json: ((E = O.contents) == null ? void 0 : E.json) ?? null
      };
    })) ?? [] : void 0
  };
  return s.success ? {
    $kind: "Transaction",
    Transaction: c,
    FailedTransaction: void 0
  } : {
    $kind: "FailedTransaction",
    Transaction: void 0,
    FailedTransaction: c
  };
}
function ti(e) {
  let t = null;
  return e.ref === "&" ? t = "immutable" : e.ref === "&mut" && (t = "mutable"), {
    reference: t,
    body: hs(e.body)
  };
}
function Lo(e) {
  var t;
  if (ap(e) === "MoveAbort" && (e == null ? void 0 : e.abortCode) != null) {
    const n = sp(e), a = rp(e), s = (t = e.message) == null ? void 0 : t.match(/in (\d+)\w* command/), r = s ? parseInt(s[1], 10) - 1 : void 0;
    return {
      $kind: "MoveAbort",
      message: Io({
        command: r,
        location: n ? {
          package: n.package,
          module: n.module,
          functionName: n.functionName,
          instruction: n.instruction
        } : void 0,
        abortCode: e.abortCode,
        cleverError: a ? {
          lineNumber: a.lineNumber,
          constantName: a.constantName,
          value: a.value
        } : void 0
      }),
      command: r,
      MoveAbort: {
        abortCode: e.abortCode,
        location: n,
        cleverError: a
      }
    };
  }
  return {
    $kind: "Unknown",
    message: (e == null ? void 0 : e.message) ?? "Transaction failed",
    Unknown: null
  };
}
function ap(e) {
  var t, n;
  return (e == null ? void 0 : e.abortCode) != null ? "MoveAbort" : ((n = (t = e == null ? void 0 : e.message) == null ? void 0 : t.match(/^(\w+)/)) == null ? void 0 : n[1]) ?? "Unknown";
}
function sp(e) {
  var t, n, a, s, r, i, c;
  if ((n = (t = e.module) == null ? void 0 : t.package) != null && n.address && ((a = e.module) != null && a.name))
    return {
      package: (r = (s = e.module) == null ? void 0 : s.package) == null ? void 0 : r.address,
      module: (i = e.module) == null ? void 0 : i.name,
      functionName: (c = e.function) == null ? void 0 : c.name,
      instruction: e.instructionOffset ?? void 0
    };
}
function rp(e) {
  if (e.identifier || e.constant)
    return {
      constantName: e.identifier ?? void 0,
      value: e.constant ?? void 0,
      lineNumber: e.sourceLineNumber ?? void 0
    };
}
function hs(e) {
  switch (e) {
    case "address":
      return { $kind: "address" };
    case "bool":
      return { $kind: "bool" };
    case "u8":
      return { $kind: "u8" };
    case "u16":
      return { $kind: "u16" };
    case "u32":
      return { $kind: "u32" };
    case "u64":
      return { $kind: "u64" };
    case "u128":
      return { $kind: "u128" };
    case "u256":
      return { $kind: "u256" };
  }
  if (typeof e == "string") throw new Error(`Unknown type: ${e}`);
  if ("vector" in e) return {
    $kind: "vector",
    vector: hs(e.vector)
  };
  if ("datatype" in e) return {
    $kind: "datatype",
    datatype: {
      typeName: `${H(e.datatype.package)}::${e.datatype.module}::${e.datatype.type}`,
      typeParameters: e.datatype.typeParameters.map((t) => hs(t))
    }
  };
  if ("typeParameter" in e) return {
    $kind: "typeParameter",
    index: e.typeParameter
  };
  throw new Error(`Unknown type: ${JSON.stringify(e)}`);
}
function ip(e, t) {
  if (!!!e)
    throw new Error(t);
}
const zo = {
  Name: [],
  Document: ["definitions"],
  OperationDefinition: [
    "description",
    "name",
    "variableDefinitions",
    "directives",
    "selectionSet"
  ],
  VariableDefinition: [
    "description",
    "variable",
    "type",
    "defaultValue",
    "directives"
  ],
  Variable: ["name"],
  SelectionSet: ["selections"],
  Field: ["alias", "name", "arguments", "directives", "selectionSet"],
  Argument: ["name", "value"],
  FragmentSpread: ["name", "directives"],
  InlineFragment: ["typeCondition", "directives", "selectionSet"],
  FragmentDefinition: [
    "description",
    "name",
    // Note: fragment variable definitions are deprecated and will removed in v17.0.0
    "variableDefinitions",
    "typeCondition",
    "directives",
    "selectionSet"
  ],
  IntValue: [],
  FloatValue: [],
  StringValue: [],
  BooleanValue: [],
  NullValue: [],
  EnumValue: [],
  ListValue: ["values"],
  ObjectValue: ["fields"],
  ObjectField: ["name", "value"],
  Directive: ["name", "arguments"],
  NamedType: ["name"],
  ListType: ["type"],
  NonNullType: ["type"],
  SchemaDefinition: ["description", "directives", "operationTypes"],
  OperationTypeDefinition: ["type"],
  ScalarTypeDefinition: ["description", "name", "directives"],
  ObjectTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields"
  ],
  FieldDefinition: ["description", "name", "arguments", "type", "directives"],
  InputValueDefinition: [
    "description",
    "name",
    "type",
    "defaultValue",
    "directives"
  ],
  InterfaceTypeDefinition: [
    "description",
    "name",
    "interfaces",
    "directives",
    "fields"
  ],
  UnionTypeDefinition: ["description", "name", "directives", "types"],
  EnumTypeDefinition: ["description", "name", "directives", "values"],
  EnumValueDefinition: ["description", "name", "directives"],
  InputObjectTypeDefinition: ["description", "name", "directives", "fields"],
  DirectiveDefinition: [
    "description",
    "name",
    "arguments",
    "directives",
    "locations"
  ],
  SchemaExtension: ["directives", "operationTypes"],
  DirectiveExtension: ["name", "directives"],
  ScalarTypeExtension: ["name", "directives"],
  ObjectTypeExtension: ["name", "interfaces", "directives", "fields"],
  InterfaceTypeExtension: ["name", "interfaces", "directives", "fields"],
  UnionTypeExtension: ["name", "directives", "types"],
  EnumTypeExtension: ["name", "directives", "values"],
  InputObjectTypeExtension: ["name", "directives", "fields"],
  TypeCoordinate: ["name"],
  MemberCoordinate: ["name", "memberName"],
  ArgumentCoordinate: ["name", "fieldName", "argumentName"],
  DirectiveCoordinate: ["name"],
  DirectiveArgumentCoordinate: ["name", "argumentName"]
}, cp = new Set(Object.keys(zo));
function ni(e) {
  const t = e == null ? void 0 : e.kind;
  return typeof t == "string" && cp.has(t);
}
var ai;
(function(e) {
  e.QUERY = "query", e.MUTATION = "mutation", e.SUBSCRIPTION = "subscription";
})(ai || (ai = {}));
var As;
(function(e) {
  e.NAME = "Name", e.DOCUMENT = "Document", e.OPERATION_DEFINITION = "OperationDefinition", e.VARIABLE_DEFINITION = "VariableDefinition", e.SELECTION_SET = "SelectionSet", e.FIELD = "Field", e.ARGUMENT = "Argument", e.FRAGMENT_SPREAD = "FragmentSpread", e.INLINE_FRAGMENT = "InlineFragment", e.FRAGMENT_DEFINITION = "FragmentDefinition", e.VARIABLE = "Variable", e.INT = "IntValue", e.FLOAT = "FloatValue", e.STRING = "StringValue", e.BOOLEAN = "BooleanValue", e.NULL = "NullValue", e.ENUM = "EnumValue", e.LIST = "ListValue", e.OBJECT = "ObjectValue", e.OBJECT_FIELD = "ObjectField", e.DIRECTIVE = "Directive", e.NAMED_TYPE = "NamedType", e.LIST_TYPE = "ListType", e.NON_NULL_TYPE = "NonNullType", e.SCHEMA_DEFINITION = "SchemaDefinition", e.OPERATION_TYPE_DEFINITION = "OperationTypeDefinition", e.SCALAR_TYPE_DEFINITION = "ScalarTypeDefinition", e.OBJECT_TYPE_DEFINITION = "ObjectTypeDefinition", e.FIELD_DEFINITION = "FieldDefinition", e.INPUT_VALUE_DEFINITION = "InputValueDefinition", e.INTERFACE_TYPE_DEFINITION = "InterfaceTypeDefinition", e.UNION_TYPE_DEFINITION = "UnionTypeDefinition", e.ENUM_TYPE_DEFINITION = "EnumTypeDefinition", e.ENUM_VALUE_DEFINITION = "EnumValueDefinition", e.INPUT_OBJECT_TYPE_DEFINITION = "InputObjectTypeDefinition", e.DIRECTIVE_DEFINITION = "DirectiveDefinition", e.SCHEMA_EXTENSION = "SchemaExtension", e.DIRECTIVE_EXTENSION = "DirectiveExtension", e.SCALAR_TYPE_EXTENSION = "ScalarTypeExtension", e.OBJECT_TYPE_EXTENSION = "ObjectTypeExtension", e.INTERFACE_TYPE_EXTENSION = "InterfaceTypeExtension", e.UNION_TYPE_EXTENSION = "UnionTypeExtension", e.ENUM_TYPE_EXTENSION = "EnumTypeExtension", e.INPUT_OBJECT_TYPE_EXTENSION = "InputObjectTypeExtension", e.TYPE_COORDINATE = "TypeCoordinate", e.MEMBER_COORDINATE = "MemberCoordinate", e.ARGUMENT_COORDINATE = "ArgumentCoordinate", e.DIRECTIVE_COORDINATE = "DirectiveCoordinate", e.DIRECTIVE_ARGUMENT_COORDINATE = "DirectiveArgumentCoordinate";
})(As || (As = {}));
function si(e) {
  return e === 9 || e === 32;
}
function op(e, t) {
  const n = e.replace(/"""/g, '\\"""'), a = n.split(/\r\n|[\n\r]/g), s = a.length === 1, r = a.length > 1 && a.slice(1).every((p) => p.length === 0 || si(p.charCodeAt(0))), i = n.endsWith('\\"""'), c = e.endsWith('"') && !i, o = e.endsWith("\\"), d = c || o, u = (
    // add leading and trailing new lines only if it improves readability
    !s || e.length > 70 || d || r || i
  );
  let l = "";
  const b = s && si(e.charCodeAt(0));
  return (u && !b || r) && (l += `
`), l += n, (u || d) && (l += `
`), '"""' + l + '"""';
}
const dp = 10, Go = 2;
function fp(e) {
  return Aa(e, []);
}
function Aa(e, t) {
  switch (typeof e) {
    case "string":
      return JSON.stringify(e);
    case "function":
      return e.name ? `[function ${e.name}]` : "[function]";
    case "object":
      return up(e, t);
    default:
      return String(e);
  }
}
function up(e, t) {
  if (e === null)
    return "null";
  if (t.includes(e))
    return "[Circular]";
  const n = [...t, e];
  if (lp(e)) {
    const a = e.toJSON();
    if (a !== e)
      return typeof a == "string" ? a : Aa(a, n);
  } else if (Array.isArray(e))
    return pp(e, n);
  return bp(e, n);
}
function lp(e) {
  return typeof e.toJSON == "function";
}
function bp(e, t) {
  const n = Object.entries(e);
  return n.length === 0 ? "{}" : t.length > Go ? "[" + mp(e) + "]" : "{ " + n.map(
    ([s, r]) => s + ": " + Aa(r, t)
  ).join(", ") + " }";
}
function pp(e, t) {
  if (e.length === 0)
    return "[]";
  if (t.length > Go)
    return "[Array]";
  const n = Math.min(dp, e.length), a = e.length - n, s = [];
  for (let r = 0; r < n; ++r)
    s.push(Aa(e[r], t));
  return a === 1 ? s.push("... 1 more item") : a > 1 && s.push(`... ${a} more items`), "[" + s.join(", ") + "]";
}
function mp(e) {
  const t = Object.prototype.toString.call(e).replace(/^\[object /, "").replace(/]$/, "");
  if (t === "Object" && typeof e.constructor == "function") {
    const n = e.constructor.name;
    if (typeof n == "string" && n !== "")
      return n;
  }
  return t;
}
function gp(e) {
  return `"${e.replace(hp, Ap)}"`;
}
const hp = /[\x00-\x1f\x22\x5c\x7f-\x9f]/g;
function Ap(e) {
  return yp[e.charCodeAt(0)];
}
const yp = [
  "\\u0000",
  "\\u0001",
  "\\u0002",
  "\\u0003",
  "\\u0004",
  "\\u0005",
  "\\u0006",
  "\\u0007",
  "\\b",
  "\\t",
  "\\n",
  "\\u000B",
  "\\f",
  "\\r",
  "\\u000E",
  "\\u000F",
  "\\u0010",
  "\\u0011",
  "\\u0012",
  "\\u0013",
  "\\u0014",
  "\\u0015",
  "\\u0016",
  "\\u0017",
  "\\u0018",
  "\\u0019",
  "\\u001A",
  "\\u001B",
  "\\u001C",
  "\\u001D",
  "\\u001E",
  "\\u001F",
  "",
  "",
  '\\"',
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 2F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 3F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 4F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\\\",
  "",
  "",
  "",
  // 5F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  // 6F
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "\\u007F",
  "\\u0080",
  "\\u0081",
  "\\u0082",
  "\\u0083",
  "\\u0084",
  "\\u0085",
  "\\u0086",
  "\\u0087",
  "\\u0088",
  "\\u0089",
  "\\u008A",
  "\\u008B",
  "\\u008C",
  "\\u008D",
  "\\u008E",
  "\\u008F",
  "\\u0090",
  "\\u0091",
  "\\u0092",
  "\\u0093",
  "\\u0094",
  "\\u0095",
  "\\u0096",
  "\\u0097",
  "\\u0098",
  "\\u0099",
  "\\u009A",
  "\\u009B",
  "\\u009C",
  "\\u009D",
  "\\u009E",
  "\\u009F"
], wp = Object.freeze({});
function Tp(e, t, n = zo) {
  const a = /* @__PURE__ */ new Map();
  for (const w of Object.values(As))
    a.set(w, vp(t, w));
  let s, r = Array.isArray(e), i = [e], c = -1, o = [], d = e, u, l;
  const b = [], p = [];
  do {
    c++;
    const w = c === i.length, I = w && o.length !== 0;
    if (w) {
      if (u = p.length === 0 ? void 0 : b[b.length - 1], d = l, l = p.pop(), I)
        if (r) {
          d = d.slice();
          let R = 0;
          for (const [F, j] of o) {
            const D = F - R;
            j === null ? (d.splice(D, 1), R++) : d[D] = j;
          }
        } else {
          d = { ...d };
          for (const [R, F] of o)
            d[R] = F;
        }
      c = s.index, i = s.keys, o = s.edits, r = s.inArray, s = s.prev;
    } else if (l) {
      if (u = r ? c : i[c], d = l[u], d == null)
        continue;
      b.push(u);
    }
    let C;
    if (!Array.isArray(d)) {
      var m, h;
      ni(d) || ip(!1, `Invalid AST Node: ${fp(d)}.`);
      const R = w ? (m = a.get(d.kind)) === null || m === void 0 ? void 0 : m.leave : (h = a.get(d.kind)) === null || h === void 0 ? void 0 : h.enter;
      if (C = R == null ? void 0 : R.call(t, d, u, l, b, p), C === wp)
        break;
      if (C === !1) {
        if (!w) {
          b.pop();
          continue;
        }
      } else if (C !== void 0 && (o.push([u, C]), !w))
        if (ni(C))
          d = C;
        else {
          b.pop();
          continue;
        }
    }
    if (C === void 0 && I && o.push([u, d]), w)
      b.pop();
    else {
      var y;
      s = {
        inArray: r,
        index: c,
        keys: i,
        edits: o,
        prev: s
      }, r = Array.isArray(d), i = r ? d : (y = n[d.kind]) !== null && y !== void 0 ? y : [], c = -1, o = [], l && p.push(l), l = d;
    }
  } while (s !== void 0);
  return o.length !== 0 ? o[o.length - 1][1] : e;
}
function vp(e, t) {
  const n = e[t];
  return typeof n == "object" ? n : typeof n == "function" ? {
    enter: n,
    leave: void 0
  } : {
    enter: e.enter,
    leave: e.leave
  };
}
function Ip(e) {
  return Tp(e, Ep);
}
const Op = 80, Ep = {
  Name: {
    leave: (e) => e.value
  },
  Variable: {
    leave: (e) => "$" + e.name
  },
  // Document
  Document: {
    leave: (e) => _(e.definitions, `

`)
  },
  OperationDefinition: {
    leave(e) {
      const t = $a(e.variableDefinitions) ? L(`(
`, _(e.variableDefinitions, `
`), `
)`) : L("(", _(e.variableDefinitions, ", "), ")"), n = L("", e.description, `
`) + _(
        [
          e.operation,
          _([e.name, t]),
          _(e.directives, " ")
        ],
        " "
      );
      return (n === "query" ? "" : n + " ") + e.selectionSet;
    }
  },
  VariableDefinition: {
    leave: ({ variable: e, type: t, defaultValue: n, directives: a, description: s }) => L("", s, `
`) + e + ": " + t + L(" = ", n) + L(" ", _(a, " "))
  },
  SelectionSet: {
    leave: ({ selections: e }) => le(e)
  },
  Field: {
    leave({ alias: e, name: t, arguments: n, directives: a, selectionSet: s }) {
      const r = L("", e, ": ") + t;
      let i = r + L("(", _(n, ", "), ")");
      return i.length > Op && (i = r + L(`(
`, Ln(_(n, `
`)), `
)`)), _([i, _(a, " "), s], " ");
    }
  },
  Argument: {
    leave: ({ name: e, value: t }) => e + ": " + t
  },
  // Fragments
  FragmentSpread: {
    leave: ({ name: e, directives: t }) => "..." + e + L(" ", _(t, " "))
  },
  InlineFragment: {
    leave: ({ typeCondition: e, directives: t, selectionSet: n }) => _(
      [
        "...",
        L("on ", e),
        _(t, " "),
        n
      ],
      " "
    )
  },
  FragmentDefinition: {
    leave: ({
      name: e,
      typeCondition: t,
      variableDefinitions: n,
      directives: a,
      selectionSet: s,
      description: r
    }) => L("", r, `
`) + // Note: fragment variable definitions are experimental and may be changed
    // or removed in the future.
    `fragment ${e}${L("(", _(n, ", "), ")")} on ${t} ${L("", _(a, " "), " ")}` + s
  },
  // Value
  IntValue: {
    leave: ({ value: e }) => e
  },
  FloatValue: {
    leave: ({ value: e }) => e
  },
  StringValue: {
    leave: ({ value: e, block: t }) => t ? op(e) : gp(e)
  },
  BooleanValue: {
    leave: ({ value: e }) => e ? "true" : "false"
  },
  NullValue: {
    leave: () => "null"
  },
  EnumValue: {
    leave: ({ value: e }) => e
  },
  ListValue: {
    leave: ({ values: e }) => "[" + _(e, ", ") + "]"
  },
  ObjectValue: {
    leave: ({ fields: e }) => "{" + _(e, ", ") + "}"
  },
  ObjectField: {
    leave: ({ name: e, value: t }) => e + ": " + t
  },
  // Directive
  Directive: {
    leave: ({ name: e, arguments: t }) => "@" + e + L("(", _(t, ", "), ")")
  },
  // Type
  NamedType: {
    leave: ({ name: e }) => e
  },
  ListType: {
    leave: ({ type: e }) => "[" + e + "]"
  },
  NonNullType: {
    leave: ({ type: e }) => e + "!"
  },
  // Type System Definitions
  SchemaDefinition: {
    leave: ({ description: e, directives: t, operationTypes: n }) => L("", e, `
`) + _(["schema", _(t, " "), le(n)], " ")
  },
  OperationTypeDefinition: {
    leave: ({ operation: e, type: t }) => e + ": " + t
  },
  ScalarTypeDefinition: {
    leave: ({ description: e, name: t, directives: n }) => L("", e, `
`) + _(["scalar", t, _(n, " ")], " ")
  },
  ObjectTypeDefinition: {
    leave: ({ description: e, name: t, interfaces: n, directives: a, fields: s }) => L("", e, `
`) + _(
      [
        "type",
        t,
        L("implements ", _(n, " & ")),
        _(a, " "),
        le(s)
      ],
      " "
    )
  },
  FieldDefinition: {
    leave: ({ description: e, name: t, arguments: n, type: a, directives: s }) => L("", e, `
`) + t + ($a(n) ? L(`(
`, Ln(_(n, `
`)), `
)`) : L("(", _(n, ", "), ")")) + ": " + a + L(" ", _(s, " "))
  },
  InputValueDefinition: {
    leave: ({ description: e, name: t, type: n, defaultValue: a, directives: s }) => L("", e, `
`) + _(
      [t + ": " + n, L("= ", a), _(s, " ")],
      " "
    )
  },
  InterfaceTypeDefinition: {
    leave: ({ description: e, name: t, interfaces: n, directives: a, fields: s }) => L("", e, `
`) + _(
      [
        "interface",
        t,
        L("implements ", _(n, " & ")),
        _(a, " "),
        le(s)
      ],
      " "
    )
  },
  UnionTypeDefinition: {
    leave: ({ description: e, name: t, directives: n, types: a }) => L("", e, `
`) + _(
      ["union", t, _(n, " "), L("= ", _(a, " | "))],
      " "
    )
  },
  EnumTypeDefinition: {
    leave: ({ description: e, name: t, directives: n, values: a }) => L("", e, `
`) + _(["enum", t, _(n, " "), le(a)], " ")
  },
  EnumValueDefinition: {
    leave: ({ description: e, name: t, directives: n }) => L("", e, `
`) + _([t, _(n, " ")], " ")
  },
  InputObjectTypeDefinition: {
    leave: ({ description: e, name: t, directives: n, fields: a }) => L("", e, `
`) + _(["input", t, _(n, " "), le(a)], " ")
  },
  DirectiveDefinition: {
    leave: ({
      description: e,
      name: t,
      arguments: n,
      directives: a,
      repeatable: s,
      locations: r
    }) => L("", e, `
`) + "directive @" + t + ($a(n) ? L(`(
`, Ln(_(n, `
`)), `
)`) : L("(", _(n, ", "), ")")) + L(" ", _(a, " ")) + (s ? " repeatable" : "") + " on " + _(r, " | ")
  },
  SchemaExtension: {
    leave: ({ directives: e, operationTypes: t }) => _(
      ["extend schema", _(e, " "), le(t)],
      " "
    )
  },
  ScalarTypeExtension: {
    leave: ({ name: e, directives: t }) => _(["extend scalar", e, _(t, " ")], " ")
  },
  ObjectTypeExtension: {
    leave: ({ name: e, interfaces: t, directives: n, fields: a }) => _(
      [
        "extend type",
        e,
        L("implements ", _(t, " & ")),
        _(n, " "),
        le(a)
      ],
      " "
    )
  },
  InterfaceTypeExtension: {
    leave: ({ name: e, interfaces: t, directives: n, fields: a }) => _(
      [
        "extend interface",
        e,
        L("implements ", _(t, " & ")),
        _(n, " "),
        le(a)
      ],
      " "
    )
  },
  UnionTypeExtension: {
    leave: ({ name: e, directives: t, types: n }) => _(
      [
        "extend union",
        e,
        _(t, " "),
        L("= ", _(n, " | "))
      ],
      " "
    )
  },
  EnumTypeExtension: {
    leave: ({ name: e, directives: t, values: n }) => _(["extend enum", e, _(t, " "), le(n)], " ")
  },
  InputObjectTypeExtension: {
    leave: ({ name: e, directives: t, fields: n }) => _(["extend input", e, _(t, " "), le(n)], " ")
  },
  DirectiveExtension: {
    leave: ({ name: e, directives: t }) => _(["extend directive @" + e, _(t, " ")], " ")
  },
  // Schema Coordinates
  TypeCoordinate: {
    leave: ({ name: e }) => e
  },
  MemberCoordinate: {
    leave: ({ name: e, memberName: t }) => _([e, L(".", t)])
  },
  ArgumentCoordinate: {
    leave: ({ name: e, fieldName: t, argumentName: n }) => _([e, L(".", t), L("(", n, ":)")])
  },
  DirectiveCoordinate: {
    leave: ({ name: e }) => _(["@", e])
  },
  DirectiveArgumentCoordinate: {
    leave: ({ name: e, argumentName: t }) => _(["@", e, L("(", t, ":)")])
  }
};
function _(e, t = "") {
  var n;
  return (n = e == null ? void 0 : e.filter((a) => a).join(t)) !== null && n !== void 0 ? n : "";
}
function le(e) {
  return L(`{
`, Ln(_(e, `
`)), `
}`);
}
function L(e, t, n = "") {
  return t != null && t !== "" ? e + t + n : "";
}
function Ln(e) {
  return L("  ", e.replace(/\n/g, `
  `));
}
function $a(e) {
  var t;
  return (t = e == null ? void 0 : e.some((n) => n.includes(`
`))) !== null && t !== void 0 ? t : !1;
}
var Sp = class extends Error {
};
const kp = Symbol.for("@mysten/SuiGraphQLClient");
var ln, bn, pn, mn, yi, Np = (yi = class extends To {
  constructor({ url: t, fetch: n = fetch, headers: a = {}, queries: s = {}, network: r, mvr: i }) {
    super({ network: r });
    o0(this, ln);
    o0(this, bn);
    o0(this, pn);
    o0(this, mn);
    W(this, ln, t), W(this, bn, s), W(this, pn, a), W(this, mn, (...c) => n(...c)), this.core = new tp({
      graphqlClient: this,
      mvr: i
    });
  }
  get mvr() {
    return this.core.mvr;
  }
  get [kp]() {
    return !0;
  }
  async query(t) {
    const n = await g(this, mn).call(this, g(this, ln), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...g(this, pn)
      },
      body: JSON.stringify({
        query: typeof t.query == "string" || t.query instanceof String ? String(t.query) : Ip(t.query),
        variables: t.variables,
        extensions: t.extensions,
        operationName: t.operationName
      }),
      signal: t.signal
    });
    if (!n.ok) throw new Sp(`GraphQL request failed: ${n.statusText} (${n.status})`);
    return await n.json();
  }
  async execute(t, n) {
    return this.query({
      ...n,
      query: g(this, bn)[t]
    });
  }
  getObjects(t) {
    return this.core.getObjects(t);
  }
  getObject(t) {
    return this.core.getObject(t);
  }
  listCoins(t) {
    return this.core.listCoins(t);
  }
  listOwnedObjects(t) {
    return this.core.listOwnedObjects(t);
  }
  getBalance(t) {
    return this.core.getBalance(t);
  }
  listBalances(t) {
    return this.core.listBalances(t);
  }
  getCoinMetadata(t) {
    return this.core.getCoinMetadata(t);
  }
  getTransaction(t) {
    return this.core.getTransaction(t);
  }
  executeTransaction(t) {
    return this.core.executeTransaction(t);
  }
  signAndExecuteTransaction(t) {
    return this.core.signAndExecuteTransaction(t);
  }
  waitForTransaction(t) {
    return this.core.waitForTransaction(t);
  }
  simulateTransaction(t) {
    return this.core.simulateTransaction(t);
  }
  getReferenceGasPrice(t) {
    return this.core.getReferenceGasPrice(t);
  }
  getCurrentSystemState(t) {
    return this.core.getCurrentSystemState(t);
  }
  getProtocolConfig(t) {
    return this.core.getProtocolConfig(t);
  }
  getChainIdentifier(t) {
    return this.core.getChainIdentifier(t);
  }
  async listDynamicFields(t) {
    var i, c;
    const n = ((i = t.include) == null ? void 0 : i.value) ?? !1, { data: a, errors: s } = await this.query({
      query: al,
      signal: t.signal,
      variables: {
        parentId: t.parentId,
        first: t.limit,
        cursor: t.cursor,
        includeValue: n
      }
    });
    if (s != null && s.length) throw s.length === 1 ? new Error(s[0].message) : new AggregateError(s.map((o) => new Error(o.message)));
    const r = (c = a == null ? void 0 : a.address) == null ? void 0 : c.dynamicFields;
    if (!r) throw new Error("Missing response data");
    return {
      dynamicFields: r.nodes.map((o) => {
        var p, m, h, y, w, I, C, R, F, j, D, P, O, Q, $, v, q, b0, x, G, E, p0;
        const d = ((p = o.value) == null ? void 0 : p.__typename) === "MoveObject" ? (h = (m = o.value.contents) == null ? void 0 : m.type) == null ? void 0 : h.repr : (w = (y = o.value) == null ? void 0 : y.type) == null ? void 0 : w.repr, u = ((I = o.value) == null ? void 0 : I.__typename) === "MoveObject", l = u ? `0x2::dynamic_object_field::Wrapper<${(R = (C = o.name) == null ? void 0 : C.type) == null ? void 0 : R.repr}>` : (j = (F = o.name) == null ? void 0 : F.type) == null ? void 0 : j.repr;
        let b;
        if (n) {
          let J;
          ((D = o.value) == null ? void 0 : D.__typename) === "MoveValue" ? J = z0(o.value.bcs ?? "") : ((P = o.value) == null ? void 0 : P.__typename) === "MoveObject" ? J = z0(((O = o.value.contents) == null ? void 0 : O.bcs) ?? "") : J = new Uint8Array(), b = {
            type: d,
            bcs: J
          };
        }
        return {
          $kind: u ? "DynamicObject" : "DynamicField",
          fieldId: In(t.parentId, l, z0((Q = o.name) == null ? void 0 : Q.bcs)),
          type: ye(u ? `0x2::dynamic_field::Field<0x2::dynamic_object_field::Wrapper<${(v = ($ = o.name) == null ? void 0 : $.type) == null ? void 0 : v.repr}>,0x2::object::ID>` : `0x2::dynamic_field::Field<${(b0 = (q = o.name) == null ? void 0 : q.type) == null ? void 0 : b0.repr},${d}>`),
          name: {
            type: (G = (x = o.name) == null ? void 0 : x.type) == null ? void 0 : G.repr,
            bcs: z0((E = o.name) == null ? void 0 : E.bcs)
          },
          valueType: d,
          childId: u && ((p0 = o.value) == null ? void 0 : p0.__typename) === "MoveObject" ? o.value.address : void 0,
          value: n ? b : void 0
        };
      }),
      cursor: r.pageInfo.endCursor ?? null,
      hasNextPage: r.pageInfo.hasNextPage
    };
  }
  getDynamicField(t) {
    return this.core.getDynamicField(t);
  }
  getDynamicObjectField(t) {
    return this.core.getDynamicObjectField(t);
  }
  listTransactions(t) {
    return this.core.listTransactions(t);
  }
  listEvents(t) {
    return this.core.listEvents(t);
  }
  getMoveFunction(t) {
    return this.core.getMoveFunction(t);
  }
  resolveTransactionPlugin() {
    return this.core.resolveTransactionPlugin();
  }
  verifyZkLoginSignature(t) {
    return this.core.verifyZkLoginSignature(t);
  }
  defaultNameServiceName(t) {
    return this.core.defaultNameServiceName(t);
  }
  resolveNameServiceAddress(t) {
    return this.core.resolveNameServiceAddress(t);
  }
}, ln = new WeakMap(), bn = new WeakMap(), pn = new WeakMap(), mn = new WeakMap(), yi);
const Cp = [
  "oRzrCwcAAAUJAQAGAgYEAwofBCkCBSs6B2VLCLABYAaQAg4MngLRAgADAQgCAgIABwAABQABAAAEAgAAAAkDBAABAQkHAQACBgEEAAIHCAEAAwYFAggACAAIAAgAAQoCAQYKAgIGCgIDAQgAAgEKAgECAAEGCAACBwoJAAoJAAMBAQIGAgcKAgMDAwoCB0J5dGVzMzIGYXBwZW5kB2J5dGVzMzIFY29kZWMGZGVjb2RlBmVuY29kZQpmcm9tX2J5dGVzCHRvX2J5dGVzBnZlY3RvcgR3b3JkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAkW6NvehzGQ6KwN0UN/x5DmeGAacZUX7X8qvN9OdfcAwhkAAAAAAAAAAoCAQAAAQAABSYKADEBJgQJCgAxAyUMBQULCQwFCwUEDgUQBwAnMQILAEAGAgAAAAAAAAAMBg0GDgERBTgADQYOAhEFOAANBg4DEQU4AA0GDgQRBTgACwYCAAEBAAAKOwoAQQYGggAAAAAAAAAhBA0KAAYAAAAAAAAAAEIGFDECIQwBBQ8JDAELAQQSBRYLAAEHACcKAAYBAAAAAAAAAEIGFAwDCgMxASYEJAoDMQMlDAIFJgkMAgsCBCkFLQsAAQcAJwsDCgAGAgAAAAAAAAARAgoABiIAAAAAAAAAEQIKAAZCAAAAAAAAABECCwAGYgAAAAAAAAARAgIAAgAAAAsiBwEMBwYAAAAAAAAAAAwGCgYGIAAAAAAAAAAjBB0KBgwEDQcMAwsEDAUKAAoBCwUWQgYUDAILAwsCRAYLBgYBAAAAAAAAABYMBgUECwABCwcRBAIAAA==",
  "oRzrCwcAAAUNAQAuAi6GAQO0Ac0CBIEERgXHBJ0FB+QJ1wgIuxKAAga7FLUCCvAWigEL+hcCDPwXghEN/igsDqopHgBzBCUEJgU1BTYFNwVIBUoFSwVMACgHUgEgAVQBcAIpAjgCUwJsAm4CbwMkBngAGgIAAAAIAAARCAAAGwgBDAAAFQMAAAcDAAABAwAADwMAABIDAAEDAAIAAAAAARwHAAIEDAADEAcABBQAAAUGCAAGCQAABwoIAAgLBwAJDAcACwAMAAsNCAAMFgcADQ4HAQAADhgHAA8FDAEAAREIBwARGQQAEhMCABQXAgAVAgcAFh0CAABCAAEAAE4CAwAAYQQBAAB0BQEBDAAuBgEBDAA+BwEBDABnCAEBDABeCQoBDAAiCwEBDAByDAEBDABIDQEBDABaDgEBDABWDxABDAA5ERAAAFwSEwEMAGQUFQEMAC0WFwEMACwYGQEMAFkaGwEMAGMaHAEMACEaHAEMAFcPEAEMBV84CgAGMEJDAAovRkcACjRHEAALKksQAAsrUBcACyxRGQALPz8cAAtIQUIAC0lPFQALTSAhAQILXE0TAAtmPQEAC2g8AQAMQy4QAA0xKwEBAA06MikBAA07MwEBAA1FLzABAA1GLzABAA1RASsBAA1rKSsBAA5ELS4ADnYBLQEAEDMpAQEDEUAkJQEIEUEkCgEIEU0iIwARcTElABNbJwEBDBNpKQEBCBNuJwEBCBRlHgoAFTwKHAAVPSUcABVHOzAAFW07CgAVdwEcACAfLwMzJjUoNAMrKiolLSkoJSkqJioqKSclLjQ0NQMpKCkvKScpLzUuNi43MDouPgkpKEQlRAspKSkmKTMpLkgMKSpOKwoCCAAHCBwABQgLBQUKAgcIHAEIAgIGCAIGCAECBgsDAQkABggBAwcIAgYIAQcIHAMHCwMBCQAGCAEJAAMHCwMBCQAGCAEBBQYLAwEJAAYIAQcIDgoCBwgcAQUIBwsDAQkABggBBwgUBggTBggOBwgQCB0HCBwCBgsDAQkABggUAwcLAwEJAAYIFAsJAggPCAoCBwsDAQkABgoCAgYLAwEJAAIBCgIDBggUAgoCBQYLAwEJAAYIFAIKAgcIHAELCQIIDAgRBgcLAwEJAAcIFAIKAgsYAQgbBwgcAQsJAggNCBIDBgsDAQkABwgUCwkCCA0IEgIIDQgSAwYLAwEJAAYIFAsJAggMCBECCAwIEQEGCwMBCQABAgEIHQQIAQUIEwgCAQYIHAEIAAIGCQAHCBwDCAsIEwUBBwgcAQgaAQYJAAEIGQEIEwIJAAUBCAEBCQABCAsBCxYBCQAEAQgaCwMBCQAIGQEIFwEIFQEGCxYBCQABAQEGCBoBBwsWAQkAAgcLFgEJAAkAAQgEAQsDAQkAAQgFAQgHBAcIDgYICwoCBwgcAgEBAQgUAQYIHQcHCBQGCBMGCA4HCBAOCB0HCBwFBwgUBggTDg0KAgEIBgIGCBQOBAEKAggdCxYBCxgBCBsDBggUBggLCwkCCA8ICgEIDwgOCB0DCB0KAgUKAgsWAQsYAQgbAQsYAQgbCAEBAQEIHQgdCB0IHQEGCgIFAggdCB0IHQgdAQgIAwEBCgINDQoCAQEBAQoCBAMNAwMEBAYIFA4NCgICCgIKAgcGCBQGCAsOCgIKAgEHCBwBCxgBCB4JBwgUBggLDgoCCgILGAEIGwsWAQsYAQgeCxYBBQcIHAMHCBQGCAsLCQIIDQgSAwYIFAYICwsJAggMCBEIQWRtaW5DYXAFQm91bmQHQnl0ZXMzMgRDYWxsB0NhbGxDYXAEQ29pbgpFbmRwb2ludFYyBkZ1bmRlZAJJRA5MelJlY2VpdmVQYXJhbRBNZXNzYWdpbmdDaGFubmVsDE1lc3NhZ2luZ0ZlZRBNZXNzYWdpbmdSZWNlaXB0BE9BcHAGT3B0aW9uDFBhdXNlQ2hhbmdlZApRdW90ZVBhcmFtCFJlZ2lzdHJ5CFJlbGVhc2VkA1NVSQlTZW5kUGFyYW0LU2xvdENyZWF0ZWQGU3RyaW5nCVR4Q29udGV4dAhUeXBlTmFtZQNVSUQFVkFVTFQFVmF1bHQEVm9pZANaUk8IYWNrX3NlbnQJYW5ub3VuY2VkBWFzY2lpB2JhY2tpbmcEYmluZAVib3VuZAdieXRlczMyBGNhbGwIY2FsbF9jYXADY2FwBWNvZGVjBGNvaW4PY29tYmluZV9vcHRpb25zD2NvbmZpcm1fbHpfc2VuZA1jb25maXJtX3F1b3RlDGNvbmZpcm1fc2VuZAtjcmVhdGVfc2xvdAZkZWNvZGUHZGVzdHJveQxkZXN0cm95X25vbmULZHVtbXlfZmllbGQEZW1pdAZlbmNvZGUOZW5kcG9pbnRfcXVvdGUNZW5kcG9pbnRfc2VuZAtlbmRwb2ludF92MgVldmVudBFleGVjdXRpb25fb3B0aW9ucwdleHRyYWN0BGZpbGwMZnJvbV9hZGRyZXNzB2Zyb21faWQEZnVuZAhnZXRfcGVlcgJpZAppZF9hZGRyZXNzBGluaXQKaW50b19ieXRlcwtpbnRvX3N0cmluZwdpc19ub25lB2lzX3NvbWUHaXNfemVybwpsel9yZWNlaXZlB2x6X3NlbmQRbWVzc2FnaW5nX2NoYW5uZWwNbWVzc2FnaW5nX2ZlZRFtZXNzYWdpbmdfcmVjZWlwdANuZXcMbmV3X3JlZ2lzdHJ5A25mdAhuZnRfdHlwZQRub25lBG9hcHAGb2JqZWN0Bm9wdGlvbgZwYXVzZWQHcGF5bG9hZBJwYXlsb2FkX2Zvcl9yZXZpZXcEcGVlcgVwaGFzZQdwcm9jZXNzD3B1YmxpY190cmFuc2ZlcgVxdW90ZQlyZWNpcGllbnQIcmVnaXN0ZXINcmVnaXN0ZXJfb2FwcAhyZWdpc3RyeQ5yZWdpc3RyeV9hZG1pbgdyZXF1ZXN0BXJvdXRlBHNlbmQGc2VuZGVyFHNldF9lbmZvcmNlZF9vcHRpb25zCnNldF9wYXVzZWQIc2V0X3BlZXIMc2hhcmVfb2JqZWN0BHNsb3QEc29tZQNzdWkKdG9fYWRkcmVzcwh0cmFuc2Zlcgp0eF9jb250ZXh0CXR5cGVfbmFtZQx1aWRfdG9faW5uZXIIdmFsaWRhdGUFdmF1bHQLdmF1bHRfYWRtaW4HdmVyc2lvbhF3aXRoX29yaWdpbmFsX2lkcwx6ZXJvX2J5dGVzMzIDenJvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACACRbo296HMZDorA3RQ3/HkOZ4YBpxlRftfyq830519wo3p6OCHpjRwAZB/tpj9+KsEZ7NCIpt0sZJkBnrrxK6TG+rviJsIucOzfRkoD8H4t1uuWy3iQQ/DEg9APpo22sPeFQTPP9dXYnWeNT2dlTiWGOVX0FUml/GbUuTpJ8He79wor8ARDLLtuU4+V/Kxzmm1qZxQOwbRXlHPohLeVuJAMIAQAAAAAAAAAOBJZ1AAAFIARtoqnhW9giugSR2XiUfMG/sf0w5vgTpfsQubKx1qa6BSBIWVPi6t9KoCr5UM+OkU+9K2dSM4XnPDYRg0FFnY1FxAoCUlFmNmM2ZDQzOWVhMGRhMmYzZTliYTc5ZTQ5OTJhN2E0YzExMzIxNWZiZjU0YzQ0MmFjOTAyMGMzMTVmOTUzNzA1Ojpjb2xsZWN0aW9uOjpORlQDCAIAAAAAAAAAAwgDAAAAAAAAAAMIBAAAAAAAAAADCAUAAAAAAAAAAwgGAAAAAAAAAAMIBwAAAAAAAAADCAgAAAAAAAAAAwgJAAAAAAAAAAMICgAAAAAAAAADCAsAAAAAAAAAAwgMAAAAAAAAAAoCFxYAAwEAEQEAAAAAAAAAAAAAAAAAAw1ACgIBAAACATIBAQICQAgaYAgZAgIHQAgadQMnCxYBCAtSBWoLFgEIGSEFUAoCAwIQQAgadQNgCBknCAtSBU8LFgEJACEIHWMIHVgIHSMBVQFZAh8BHgFiCB1dCB0EAgNgCBlzCBlPCB0FAgJzCBlPCB0GAgJzCBlYCB0HAgJzCBlVAQgCA3MIGWIIHV0IHQMpAAAAAB0pCgEuETYHAyEEBwULCwEBBwAnDgAKATgADAMMBAsDBwIHBAoBEQEMBQoBETEOBTgBEgEMAgsECgEuETY4AgsCCwEuETY4AwsFOAQCAAEAAAABCwsEETEHAAsAOAULATgGCwILAxICAgACAAAAARgKABAAFAcAIQQHBQ0LAAELAQEHDicLARABFAsAOAEhBBUFFwcAJwIAAwAAAAEZCgA3ABQHACEEBwUNCwABCwEBBw4nCwEQARQLADcBFCEEFgUYBwAnAgAEAQAALFkKAC4LARECOAcRLBEkCgAQBBQhBA0FEwsAAQsCAQcFJwoAEAU4CAQcCgAQBjgJDAMFHgkMAwsDBCEFJwsAAQsCAQcGJwsCETEMBA4EETIMBgsEBwAKAC44AQoADwY4CgoAEAcUOAsKABAIFBE3CgYROBE7CQkxAAkJETsROzkADAUKAA8FCgY4DAsALjgBCwYOBTcCFBIEOA0LBTgOAgAFAQAAMEcKAC4LATgPCgA3AxQgBAoFDgsAAQcNJwoANwQUMQAhBCAKADcFOBAEHQoANwYUDAMFIgkMAwUiCQwDCwMEJQUpCwABBwgnDgI4ERE4CgA3AhQhBDIFNgsAAQcHJwoANgULAjgSMQEKADYEFQoALjgTCwA3AhQSBTgUAgAGAQAAAQ8KAC4LATgPCgIKADYDFQsALjgTCwISBzgVAgAHAQAAAQoKAAsBOA8LAgsANwcLAwsEERYCAAgBAAA5ZgoALgsBOA8KADcGFCAEEAoANwQUMQAhDAgFEgkMCAsIBBUFIwsAAQsDAQsCAQsEAQsHAQsFAQcIJwoCLjgWCgA3CBQhBDAOBhE5IAwJBTIJDAkLCQQ1BUMLAAELAwELAgELBAELBwELBQEHCScKAgoDCwQLBQcBCgYLBxEjCgIKAwcBSAEABxARIgsCCwMHAUgDAAcQESIKBgoANgkVCAoANgYVCwAuOBMLBhIGOBcCAAkAAAAwNAoANwAUBwAhBAcFDQsAAQsBAQcOJwoBOBYKADcIFCEEFQUbCwABCwEBBwknCgA3BhQEKAsBBwERHQsANwkUIQwCBS4LAAELAQEJDAILAgQxBTMHCicCAAoBAABAMAoALgoBOBgLAQoANwcLAhEeERcMBgEBDAQBAQwFBwEhBCELBQoANwkUIQQeDgY4GQwDBSMJDAMFIwkMAwsDBCYFKgsAAQcKJwsGOBoLAA4EOBsCAAsAAABFhwELAREYDAcMCAwGDAkxAiEEGQsJCgA3ChQhBBYLBgoANwIUIQwCBRsJDAIFGwkMAgsCBB4FIgsAAQcLJwoANwsUBCcFKwsAAQcIJw4IETkgBDQOBxE5IAwDBTYJDAMLAwQ5BT0LAAEHCycKADcEFDECIQRZCggKADcMFCEEUAoHCgA3DRQhDAQFUgkMBAsEBFUFfwsAAQcMJwoANwQUMQEhBGQKADcFOBwMBQVmCQwFCwUEaQVtCwABBwgnMQIKADYEFQoICgA2DBUKBwoANg0VCgA2BTgdDgcROjgeCwAuOBMLCAsHEgg4HwIADAAAAElqCgExASEENgoANwMUIAQKBQ4LAAEHDScKADcEFDEBIQQhCgA3BTgcBB4KADcLFCAMAgUjCQwCBSMJDAILAgQmBSoLAAEHCCcxAQoANwoUCwA3AhQROxE7ERkMBAVoCwExAyEEUAoANwQUMQIhBE0KADcFOBAESgoANw4UIAwDBVIJDAMFUgkMAwVSCQwDCwMEVQVZCwABBwgnMQMKADcKFAoANwIUCgA3DBQLADcNFBEZDAQLBAIADQAAAErcAQsBMQEhBAdIAQAMAwUJSAMADAMLAwwMCgAHAQoMBxERGgwEDgRBGwYCAAAAAAAAACQEFwUbCwABBw8nCwAHAQsMCwIRGgwJDglBGwYWAAAAAAAAACYEOA4JBgAAAAAAAAAAQhsUMQAhBDUOCQYBAAAAAAAAAEIbFDEDIQwFBToJDAUFOgkMBQsFBD0FPwcPJwYCAAAAAAAAAAwNMgAAAAAAAAAAAAAAAAAAAAAMDwoNDglBGyME0wEKDQYEAAAAAAAAABYOCUEbJQRQBVIHDycOCQoNBgEAAAAAAAAAFkIbFDQGAAEAAAAAAAAYDgkKDQYCAAAAAAAAABZCGxQ0FgwODgkKDUIbFDEBIQR2BWwOCQoNBgMAAAAAAAAAFkIbFDEBIQwGBXgJDAYLBgR7BX0HDycKDgYRAAAAAAAAACEEhAEIDAgFiAEKDgYhAAAAAAAAACEMCAsIBJQBCg0GAwAAAAAAAAAWCg4WDglBGyUMBwWWAQkMBwsHBJkBBZsBBw8nMgAAAAAAAAAAAAAAAAAAAAAMCgYAAAAAAAAAAAwLCgsGEAAAAAAAAAAjBMgBCwoxCC8OCQoNBgQAAAAAAAAAFgoLFkIbFDUbDAoKDgYhAAAAAAAAACEEwwEOCQoNBhQAAAAAAAAAFgoLFkIbFDEAIQTBAQXDAQcPJwsLBgEAAAAAAAAAFgwLBZ8BCw8LChYMDwsNBgMAAAAAAAAAFgsOFgwNBUMLDzJADQMAAAAAAAAAAAAAAAAAJgTYAQXaAQcPJwsJAgAOAQAATBYKAAoBOBgKAAoCOCAMBQoBCwILAxENDAYLAQsANwcHAQsFCwYJCwQRIQIADwEAAEwsCgAuCgEuOBgKAC4KAjggDAYKAS4KAgsDEQ0MBwsCMQEhBBkICgA2CxUFHQgKADYOFQsBCwA3BwcBCwYLBwsEOCEKBS4RNjgiCwURHwIAEAEAAAEKCgAKAS44GAsBCwA3BwsCERsCABEBAAABCQoACgE4GAsBCwA3BwsCERwCABIBAAABBAsANwQUAgATAQAAAQQLADcKFAIAFAEAAAEECwA3AhQCABUBAAABBAsACwE4IAIAAgEBAQMBAwICBgIEAgICAwIFAwYDCgMLAwUDCQMDAwQDCAMHAwwDDgMPAw0CKQMpCSkKKQspDCkNKQ4pDykQKREpEikTKRQpFSkA"
], xp = [
  "0x0000000000000000000000000000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000000000000000000000000000002",
  "0x28de9e8e087a6347001907fb698fdf8ab0467b342229b74b19264067aebc4ae9",
  "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac",
  "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24",
  "0x00245ba36f7a1cc643a2b037450dff1e4399e18069c6545fb5fcaaf37d39d7dc",
  "0x3de1504cf3fd75762759e353d9d95389618e557d0552697f19b52e4e927c1dee"
], ri = {
  modules: Cp,
  dependencies: xp
}, te = Object.freeze({ sender: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4", nft: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba", nftType: "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT", oappPackage: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24", graphql: "https://graphql.mainnet.sui.io/graphql", chain: "35834a8a", key: "nftree-original-publish-v2-a09c67e6", maxGasMist: 200000000n, maxAge: 12e4, moduleHashes: Object.freeze(["a9a4f4f7afb74b2e4fdf3b5914caa566730e843766f6ca17829484136a78d442", "a09c67e6c1fa6c4ecf0aaa64483f498cae2eb43380537b6697051e152087d939"]) }), k0 = (e, t) => {
  if (!e) throw Error(t);
}, La = (e, t, n) => k0(JSON.stringify(e) === JSON.stringify(t), n), Wo = (e) => new Np({ network: "mainnet", url: te.graphql });
function _p(e) {
  const t = e == null ? void 0 : e.chainIdentifier;
  k0(typeof t == "string", "Missing chain identifier."), k0((/^[a-f0-9]{8}$/.test(t) ? t : Qe(rn(t)).slice(0, 8)) === te.chain, "This is not Sui mainnet.");
}
function Bp(e) {
  var m, h, y, w, I, C, R, F, j, D, P, O, Q, $;
  k0((e == null ? void 0 : e.$kind) === "Transaction" && ((h = (m = e.Transaction) == null ? void 0 : m.status) == null ? void 0 : h.success) === !0, "Publication did not succeed. No NFT deposit is permitted.");
  const t = e.Transaction;
  k0(((y = t.transaction) == null ? void 0 : y.sender) === te.sender, "Wrong publication sender.");
  const n = t.transaction.commands;
  k0((n == null ? void 0 : n.length) === 2 && n[0].Publish && n[1].TransferObjects, "Unexpected publication command."), La(n[0].Publish.modules, ri.modules, "Wrong published modules."), La(n[0].Publish.dependencies, ri.dependencies, "Wrong dependencies."), La(n[1].TransferObjects.objects.map((v) => v.NestedResult), [[0, 0]], "Upgrade authority transfer changed.");
  const a = t.transaction.inputs;
  k0((a == null ? void 0 : a.length) === 1, "Unexpected publication inputs.");
  const s = (I = (w = a[n[1].TransferObjects.address.Input]) == null ? void 0 : w.Pure) == null ? void 0 : I.bytes;
  k0(s === btoa(String.fromCharCode(...Uint8Array.from(te.sender.slice(2).match(/../g), (v) => parseInt(v, 16)))), "Upgrade authority recipient changed."), k0(((C = t.transaction.gasData) == null ? void 0 : C.owner) === te.sender, "Gas must be paid by the dev wallet.");
  const r = /* @__PURE__ */ new Set([(F = (R = t.effects) == null ? void 0 : R.gasObject) == null ? void 0 : F.objectId, ...(t.transaction.gasData.payment ?? []).map((v) => v.objectId)]), i = (j = t.effects) == null ? void 0 : j.changedObjects;
  k0(Array.isArray(i) && !i.some((v) => v.objectId === te.nft), "Original NFT was unexpectedly touched.");
  const c = [];
  for (const v of i)
    if (v.inputState === "Exists")
      k0(r.has(v.objectId) && ((D = v.inputOwner) == null ? void 0 : D.AddressOwner) === te.sender, "Unexpected existing object mutation.");
    else if (["ObjectWrite", "PackageWrite"].includes(v.outputState))
      c.push(v);
    else {
      const q = v.inputState === "DoesNotExist" && v.outputState === "DoesNotExist" && v.idOperation === "Created", b0 = v.inputState === "DoesNotExist" && v.outputState === "AccumulatorWriteV1" && v.idOperation === "None" && v.outputOwner === null;
      k0(q || b0, "Unexpected object effect.");
    }
  k0(c.length === 6, "Unexpected number of created objects.");
  const o = c.map((v) => {
    var q;
    return { id: v.objectId, type: (q = t.objectTypes) == null ? void 0 : q[v.objectId], owner: v.outputOwner };
  }), d = o.filter((v) => v.type === "package");
  k0(d.length === 1, "Missing new package.");
  const u = d[0].id, l = [u + "::vault::Registry", u + "::vault::AdminCap", te.oappPackage + "::oapp::OApp", te.oappPackage + "::oapp::AdminCap", "0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap"];
  for (const v of l) {
    const q = o.filter((b0) => b0.type === v);
    k0(q.length === 1, "Created object type differs: " + v), v.endsWith("Cap") ? k0(((P = q[0].owner) == null ? void 0 : P.AddressOwner) === te.sender, "A capability left the dev wallet.") : k0(((O = q[0].owner) == null ? void 0 : O.Shared) || ((Q = q[0].owner) == null ? void 0 : Q.$kind) === "Shared", "Expected a shared empty registry/OApp.");
  }
  k0((t.events ?? []).length === 0, "Unexpected publication events.");
  const b = t.effects.gasUsed;
  k0(b, "Missing gas summary.");
  const p = BigInt(b.computationCost) + BigInt(b.storageCost) - BigInt(b.storageRebate);
  return k0(p > 0n && p <= te.maxGasMist, "Estimated gas exceeds the reviewed 0.2-SUI limit."), k0((($ = t.balanceChanges) == null ? void 0 : $.length) === 1 && t.balanceChanges[0].address === te.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -p, "Unexpected asset payment."), { gasMist: String(p), packageId: u, registryId: o.find((v) => v.type === l[0]).id, oappId: o.find((v) => v.type === l[2]).id, objects: o };
}
const jp = "9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2", Mp = "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92", Rp = "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1", Dp = "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322", Up = "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e", Pp = "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7", bt = {
  publicationDigest: jp,
  package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
  registry: Mp,
  oapp: Rp,
  vaultAdminCap: Dp,
  oappAdminCap: Up,
  upgradeCap: Pp
}, u0 = Object.freeze({ ...te, package: bt.package, registry: bt.registry, oapp: bt.oapp, admin: bt.vaultAdminCap, oappAdmin: bt.oappAdminCap, upgrade: bt.upgradeCap, publicationDigest: bt.publicationDigest, key: "nftree-original-slot-v2-ac73072b", maxGasMist: 100000000n }), S0 = (e, t) => {
  if (!e) throw Error(t);
}, oa = (e) => Array.isArray(e) ? "[" + e.map(oa).join(",") + "]" : e && typeof e == "object" ? "{" + Object.keys(e).sort().map((t) => JSON.stringify(t) + ":" + oa(e[t])).join(",") + "}" : JSON.stringify(e), za = (e, t, n) => S0(oa(e) === oa(t), n), Vp = /^0x[0-9a-f]{64}$/, Fp = (e) => btoa(String.fromCharCode(...Uint8Array.from(e.slice(2).match(/../g), (t) => parseInt(t, 16))));
function $p(e) {
  var y, w, I, C, R, F, j, D, P, O, Q, $, v, q, b0, x, G, E, p0;
  S0((e == null ? void 0 : e.$kind) === "Transaction" && ((w = (y = e.Transaction) == null ? void 0 : y.status) == null ? void 0 : w.success) === !0, "Slot creation did not succeed.");
  const t = e.Transaction;
  S0(((I = t.transaction) == null ? void 0 : I.sender) === u0.sender && ((C = t.transaction.gasData) == null ? void 0 : C.owner) === u0.sender, "Wrong sender or gas owner.");
  const n = t.transaction.commands;
  S0((n == null ? void 0 : n.length) === 1, "Only one slot creation call is allowed.");
  const a = n[0].MoveCall;
  S0((a == null ? void 0 : a.package) === u0.package && a.module === "vault" && a.function === "create_slot", "Wrong slot function."), za(a.typeArguments, [u0.nftType], "Wrong original NFT type."), za(a.arguments.map((J) => J.Input), [0, 1], "Slot arguments changed.");
  const s = t.transaction.inputs;
  S0((s == null ? void 0 : s.length) === 2, "Unexpected transaction inputs.");
  const r = (F = (R = s[0]) == null ? void 0 : R.Object) == null ? void 0 : F.SharedObject, i = (D = (j = s[1]) == null ? void 0 : j.Object) == null ? void 0 : D.ImmOrOwnedObject;
  S0((r == null ? void 0 : r.objectId) === u0.registry && String(r.initialSharedVersion) === "1" && r.mutable === !0 && (i == null ? void 0 : i.objectId) === u0.admin, "Wrong Registry/AdminCap inputs.");
  const c = (P = t.effects) == null ? void 0 : P.changedObjects;
  S0(Array.isArray(c), "Missing effects.");
  const o = [u0.nft, u0.oapp, u0.oappAdmin, u0.upgrade, u0.package];
  S0(!c.some((J) => o.includes(J.objectId)), "A protected NFT, capability or configuration was touched.");
  const d = c.filter((J) => J.inputState === "DoesNotExist" && J.outputState === "ObjectWrite");
  S0(d.length === 1, "Expected one created Vault.");
  const u = d[0];
  S0(Vp.test(u.objectId) && ((O = u.outputOwner) == null ? void 0 : O.Shared) && u.idOperation === "Created" && ((Q = t.objectTypes) == null ? void 0 : Q[u.objectId]) === u0.package + "::vault::Vault<" + u0.nftType + ">", "Unexpected created object.");
  const l = /* @__PURE__ */ new Set([($ = t.effects.gasObject) == null ? void 0 : $.objectId, ...(t.transaction.gasData.payment ?? []).map((J) => J.objectId)]);
  let b = !1;
  for (const J of c)
    if (J.inputState === "Exists") {
      if (J.objectId === u0.registry) {
        b = !0, S0(((v = J.inputOwner) == null ? void 0 : v.Shared) && ((q = J.outputOwner) == null ? void 0 : q.Shared), "Registry ownership changed.");
        continue;
      }
      if (J.objectId === u0.admin) {
        S0(((b0 = J.inputOwner) == null ? void 0 : b0.AddressOwner) === u0.sender && ((x = J.outputOwner) == null ? void 0 : x.AddressOwner) === u0.sender && J.outputState === "ObjectWrite" && t.objectTypes[J.objectId] === u0.package + "::vault::AdminCap", "Admin capability changed owner or type.");
        continue;
      }
      S0(l.has(J.objectId) && ((G = J.inputOwner) == null ? void 0 : G.AddressOwner) === u0.sender, "Unexpected existing object mutation.");
    } else J.objectId !== u.objectId && S0(J.inputState === "DoesNotExist" && J.outputState === "AccumulatorWriteV1" && J.idOperation === "None" && J.outputOwner === null, "Unexpected additional object effect.");
  S0(b, "Registry update is missing."), S0(((E = t.events) == null ? void 0 : E.length) === 1, "Unexpected events.");
  const p = t.events[0];
  S0(p.eventType === u0.package + "::vault::SlotCreated", "Wrong slot event."), za(p.json, { registry: u0.registry, vault: u.objectId, nft: { bytes: Fp(u0.nft) } }, "Slot event/backing changed.");
  const m = t.effects.gasUsed;
  S0(m, "Missing gas estimate.");
  const h = BigInt(m.computationCost) + BigInt(m.storageCost) - BigInt(m.storageRebate);
  return S0(h > 0n && h <= u0.maxGasMist, "Gas exceeds the reviewed 0.1-SUI estimate ceiling."), S0(((p0 = t.balanceChanges) == null ? void 0 : p0.length) === 1 && t.balanceChanges[0].address === u0.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -h, "Unexpected payment or recipient."), { gasMist: String(h), vaultId: u.objectId, packageId: u0.package, registryId: u0.registry };
}
async function Qo(e) {
  if (typeof e != "string" || !/^0x(?:[0-9a-f]{2})*$/i.test(e)) throw Error("Invalid bytecode.");
  const t = Uint8Array.from(e.slice(2).match(/../g) ?? [], (n) => parseInt(n, 16));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", t)), (n) => n.toString(16).padStart(2, "0")).join("");
}
function g0(e, t = "wallet RPC") {
  if (typeof e == "bigint" || typeof e == "number" && Number.isSafeInteger(e) || typeof e == "string" && (/^(0x[0-9a-f]+)$/i.test(e) || /^(0|[1-9][0-9]*)$/.test(e))) {
    const s = BigInt(e);
    if (s >= 0n && s < 1n << 256n) return s;
  }
  const a = e === null ? "null" : Array.isArray(e) ? "array" : typeof e;
  throw Error(t + " returned an invalid numeric response (" + a + "). Refresh the checks; if it persists, send this exact message back.");
}
async function _0(e, t) {
  let n;
  try {
    let a = await Promise.race([
      e.request({ ...t, params: t.params ?? [] }),
      new Promise((s, r) => {
        n = setTimeout(() => r(Error(t.method + " did not respond within 30 seconds. Refresh the deployment checks.")), 3e4);
      })
    ]);
    if (a && typeof a == "object" && a.jsonrpc === "2.0" && Object.hasOwn(a, "id")) {
      if (a.error) throw Object.assign(Error(t.method + ": " + String(a.error.message ?? "Wallet RPC error").slice(0, 200)), { code: a.error.code });
      if (!Object.hasOwn(a, "result")) throw Error(t.method + " returned an incomplete JSON-RPC response.");
      a = a.result;
    }
    return a;
  } finally {
    clearTimeout(n);
  }
}
async function Lp(e, t, n = []) {
  return g0(await _0(e, { method: t, params: n }), t);
}
const zp = (e, t) => typeof e == "string" && typeof t == "string" && e.toLowerCase() === t.toLowerCase();
async function ft(e, t) {
  if (await Lp(e, "eth_chainId") !== 56n) throw Error("Select BNB Smart Chain mainnet in your wallet.");
  const n = await _0(e, { method: "eth_accounts" });
  if (!Array.isArray(n) || !zp(n[0], t.from)) throw Error("Select the designated BNB wallet: " + t.from);
}
function zn(e, t, n) {
  const a = JSON.stringify(n);
  if (e.setItem(t, a), e.getItem(t) !== a) throw Error("Cannot persist deployment state.");
}
const Gp = Object.freeze(["https://bsc-dataseed.bnbchain.org", "https://bsc-dataseed-public.bnbchain.org"]), Wp = /* @__PURE__ */ new Set(["eth_blockNumber", "eth_getCode", "eth_call", "eth_getTransactionCount", "eth_estimateGas", "eth_gasPrice", "eth_getBalance", "eth_getTransactionReceipt", "eth_getTransactionByHash"]);
function b9(e, { fetcher: t = fetch, endpoints: n = Gp } = {}) {
  let a = 0, s = 0;
  const r = /* @__PURE__ */ new Set(), i = async (c, o, d) => {
    const u = ++s;
    let l;
    try {
      l = await t(c, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", referrerPolicy: "no-referrer", body: JSON.stringify({ jsonrpc: "2.0", id: u, method: o, params: d ?? [] }), signal: AbortSignal.timeout(8e3) });
    } catch {
      throw Object.assign(Error("Read endpoint could not be reached."), { transport: !0 });
    }
    if (!l.ok) throw Object.assign(Error("Read endpoint returned HTTP " + l.status + "."), { transport: !0 });
    let b;
    try {
      b = await l.json();
    } catch {
      throw Object.assign(Error("Read endpoint returned invalid JSON."), { transport: !0 });
    }
    if ((b == null ? void 0 : b.jsonrpc) !== "2.0" || b.id !== u) throw Error("Read endpoint response identity mismatch.");
    if (b.error) {
      const p = Error(String(b.error.message ?? "RPC error").slice(0, 250));
      throw ([-32005, -32603, -32601].includes(b.error.code) || /rate limit|too many requests|temporarily unavailable|limit exceeded/i.test(p.message)) && (p.transport = !0), p;
    }
    if (!Object.hasOwn(b, "result")) throw Error("Read endpoint returned no result.");
    return b.result;
  };
  return { request: async (c) => {
    if (!Wp.has(c.method)) return e.request(c);
    let o;
    for (let d = 0; d < n.length; d++) {
      const u = (a + d) % n.length, l = n[u];
      try {
        if (!r.has(l)) {
          if (g0(await i(l, "eth_chainId", []), "public chain ID") !== 56n) throw Error("Public read endpoint is not BNB mainnet.");
          r.add(l);
        }
        const b = await i(l, c.method, c.params);
        return a = u, b;
      } catch (b) {
        if (o = b, !b.transport) throw Error(c.method + ": " + b.message);
        r.delete(l);
      }
    }
    throw Error(c.method + ": BNB read connections are temporarily unavailable. Your pending receipt is retained. " + String((o == null ? void 0 : o.message) ?? ""));
  } };
}
const Kt = ua.contracts.TreePassAdapter, jt = Object.freeze({ from: pr.from, chainId: "0x38", endpoint: pr.endpoint, endpointSha256: "c9f13bf2b27ee03740f83f4d52f1e6f65c2d930aa6fafb09358373edc7b2b039", peer: Jt.packagePeerIdentity, route: Jt.vault, nft: Jt.nft, slotDigest: Jt.slotDigest, publicationDigest: Jt.publicationDigest, key: "nftree-original-bnb-adapter-v2-45bf0849", maxAge: 12e4 });
ic({ abi: Kt.abi, bytecode: Kt.creationBytecode, args: [jt.peer, jt.route] });
const xn = (e, t) => {
  if (!e) throw Error(t);
};
function Jo() {
  let e = Kt.runtimeTemplate.slice(2);
  const t = { 61: jt.peer, 63: jt.route, 65: jt.from };
  xn(Object.keys(Kt.immutableReferences).length === 3, "Reviewed immutable layout changed.");
  for (const [n, a] of Object.entries(Kt.immutableReferences)) {
    xn(t[n], "Unknown immutable.");
    const s = t[n].slice(2).toLowerCase().padStart(64, "0");
    for (const r of a) {
      xn(r.length === 32, "Wrong immutable width.");
      const i = r.start * 2;
      xn(e.slice(i, i + 64) === "0".repeat(64), "Runtime template is not unbound."), e = e.slice(0, i) + s + e.slice(i + 64);
    }
  }
  return "0x" + e;
}
const en = ua.contracts.TreeSuitePass, Bt = Object.freeze({ from: kf.from, chainId: "0x38", endpoint: jt.endpoint, endpointSha256: "c9f13bf2b27ee03740f83f4d52f1e6f65c2d930aa6fafb09358373edc7b2b039", peer: lt.packagePeerIdentity, route: lt.vault, nft: lt.nft, slotDigest: lt.slotDigest, publicationDigest: lt.publicationDigest, adapter: lt.bnbAdapter, adapterDigest: lt.bnbAdapterDigest, currency: "0x55d398326f99059ff775485246999027b3197955", currencySha256: "a5a6d887c581c25cba4104e4281a530044ba59d718e62cdaa80ef89900299d50", treasury: "0xc440f06bbc7e58b0d055815f915447e4ae0e3720", price: "25000000000000000000", key: "nftree-original-bnb-pass-v2-90b5292a", maxAge: 12e4 });
ic({ abi: en.abi, bytecode: en.creationBytecode, args: [Bt.adapter] });
const _n = (e, t) => {
  if (!e) throw Error(t);
};
function Yo() {
  let e = en.runtimeTemplate.slice(2);
  const t = { 870: Bt.adapter, 872: Bt.from, 874: Bt.from, 876: Bt.route };
  _n(Object.keys(en.immutableReferences).length === 4, "Reviewed immutable layout changed.");
  for (const [n, a] of Object.entries(en.immutableReferences)) {
    _n(t[n], "Unknown immutable.");
    const s = t[n].slice(2).toLowerCase().padStart(64, "0");
    for (const r of a) {
      _n(r.length === 32, "Wrong immutable width.");
      const i = r.start * 2;
      _n(e.slice(i, i + 64) === "0".repeat(64), "Runtime template is not unbound."), e = e.slice(0, i) + s + e.slice(i + 64);
    }
  }
  return "0x" + e;
}
const it = Object.freeze({ ...Bt, pass: br.bnbPass, passDigest: br.bnbPassDigest, key: "nftree-original-bnb-binding-v2-1d3da001" });
yn({ abi: ua.contracts.TreePassAdapter.abi, functionName: "bindPass", args: [it.pass] });
Object.freeze({ address: it.adapter, topics: Object.freeze([An(We("PassBound(address)")), "0x" + it.pass.slice(2).toLowerCase().padStart(64, "0")]), data: "0x" });
const c0 = Object.freeze({ ...u0, vault: it.route, adapter: it.adapter, pass: it.pass, bindingDigest: "0x64e4369cb2cf29d7a6f8cf7ee770ac27237227df9ecfab291699c1e3211b579c", endpoint: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91", endpointPackage: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac", endpointRegistry: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec", key: "nftree-original-register-v2-ac73072b" }), E0 = (e, t) => {
  if (!e) throw Error(t);
}, ii = (e, t, n) => E0(JSON.stringify(e) === JSON.stringify(t), n), Qp = /^0x[0-9a-f]{64}$/;
function Jp(e) {
  var I, C, R, F, j, D, P, O, Q, $, v, q, b0, x, G, E, p0, J, On, Js, Ys, Zs, Hs, qs, Xs, Ks, er;
  E0((e == null ? void 0 : e.$kind) === "Transaction" && ((C = (I = e.Transaction) == null ? void 0 : I.status) == null ? void 0 : C.success) === !0, "Registration failed or was already submitted. Check wallet activity.");
  const t = e.Transaction;
  E0(((R = t.transaction) == null ? void 0 : R.sender) === c0.sender && ((F = t.transaction.gasData) == null ? void 0 : F.owner) === c0.sender, "Wrong sender or gas owner.");
  const n = t.transaction.commands;
  E0((n == null ? void 0 : n.length) === 1, "Only one registration command is allowed.");
  const a = n[0].MoveCall;
  E0((a == null ? void 0 : a.package) === c0.package && a.module === "vault" && a.function === "register", "Wrong registration function."), ii(a.typeArguments, [c0.nftType], "Wrong original NFT type."), ii(a.arguments.map((a0) => a0.Input), [0, 1, 2, 3], "Wrong registration arguments.");
  const s = t.transaction.inputs;
  E0((s == null ? void 0 : s.length) === 4, "Wrong input count.");
  const r = (D = (j = s[0]) == null ? void 0 : j.Object) == null ? void 0 : D.SharedObject, i = (O = (P = s[1]) == null ? void 0 : P.Object) == null ? void 0 : O.ImmOrOwnedObject, c = ($ = (Q = s[2]) == null ? void 0 : Q.Object) == null ? void 0 : $.SharedObject;
  E0((r == null ? void 0 : r.objectId) === c0.vault && String(r.initialSharedVersion) === "2" && r.mutable === !1 && (i == null ? void 0 : i.objectId) === c0.admin && (c == null ? void 0 : c.objectId) === c0.endpoint && String(c.initialSharedVersion) === "635685314" && c.mutable === !0 && ((q = (v = s[3]) == null ? void 0 : v.Pure) == null ? void 0 : q.bytes) === "AA==", "Registration inputs changed."), E0(((b0 = t.events) == null ? void 0 : b0.length) === 1, "Unexpected registration events.");
  const o = t.events[0], d = (x = o == null ? void 0 : o.json) == null ? void 0 : x.messaging_channel;
  E0((o == null ? void 0 : o.eventType) === c0.endpointPackage + "::oapp_registry::OAppRegisteredEvent" && o.json.oapp === c0.package && o.json.oapp_info === "" && Qp.test(d), "Wrong registration event/application identity.");
  const u = (G = t.effects) == null ? void 0 : G.changedObjects;
  E0(Array.isArray(u), "Missing effects."), E0(!u.some((a0) => [c0.vault, c0.nft, c0.registry, c0.oapp, c0.oappAdmin, c0.upgrade, c0.package].includes(a0.objectId)), "Protected custody or configuration changed.");
  const l = u.filter((a0) => a0.inputState === "DoesNotExist" && a0.outputState === "ObjectWrite");
  E0(l.length === 2, "Expected channel and registry field only.");
  const b = l.find((a0) => a0.objectId === d);
  E0((b == null ? void 0 : b.idOperation) === "Created" && ((E = b.outputOwner) == null ? void 0 : E.Shared) && ((p0 = t.objectTypes) == null ? void 0 : p0[d]) === c0.endpointPackage + "::messaging_channel::MessagingChannel", "Missing shared messaging channel.");
  const p = l.find((a0) => a0 !== b);
  E0(p.idOperation === "Created" && ((J = p.outputOwner) == null ? void 0 : J.ObjectOwner) === c0.endpointRegistry && ((Js = (On = t.objectTypes) == null ? void 0 : On[p.objectId]) == null ? void 0 : Js.replace(/^0x0*2::/, "0x2::").replace(/\s/g, "")) === "0x2::dynamic_field::Field<address," + c0.endpointPackage + "::oapp_registry::OAppRegistration>", "Wrong registry field effect.");
  const m = /* @__PURE__ */ new Set([(Ys = t.effects.gasObject) == null ? void 0 : Ys.objectId, ...(t.transaction.gasData.payment ?? []).map((a0) => a0.objectId)]);
  let h = !1;
  for (const a0 of u)
    a0.inputState === "Exists" ? a0.objectId === c0.endpoint ? (h = !0, E0(((Zs = a0.inputOwner) == null ? void 0 : Zs.Shared) && ((Hs = a0.outputOwner) == null ? void 0 : Hs.Shared) && a0.outputState === "ObjectWrite", "Endpoint changed ownership.")) : a0.objectId === c0.admin ? E0(((qs = a0.inputOwner) == null ? void 0 : qs.AddressOwner) === c0.sender && ((Xs = a0.outputOwner) == null ? void 0 : Xs.AddressOwner) === c0.sender && a0.outputState === "ObjectWrite", "Admin changed ownership.") : E0(m.has(a0.objectId) && ((Ks = a0.inputOwner) == null ? void 0 : Ks.AddressOwner) === c0.sender, "Unexpected existing object mutation.") : l.includes(a0) || E0(a0.inputState === "DoesNotExist" && a0.outputOwner === null && (a0.outputState === "AccumulatorWriteV1" && a0.idOperation === "None" || a0.outputState === "DoesNotExist" && a0.idOperation === "Created"), "Unexpected additional effects.");
  E0(h, "Endpoint update missing.");
  const y = t.effects.gasUsed;
  E0(y, "Missing gas effects.");
  const w = BigInt(y.computationCost) + BigInt(y.storageCost) - BigInt(y.storageRebate);
  return E0(w > 0n && w <= c0.maxGasMist, "Gas exceeds the 0.1-SUI estimate ceiling."), E0(((er = t.balanceChanges) == null ? void 0 : er.length) === 1 && t.balanceChanges[0].address === c0.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -w, "Unexpected payment."), { gasMist: String(w), channelId: d, registryEntryId: p.objectId };
}
const Yt = Object.freeze({
  sender: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4",
  package: "0x2f3671d48dd000a27fd466fd347796149f5cd30cb16e1d22d2d89466ffc3d900",
  bridge: "0x4ae75e55799f0a4e34941503542990f1628f1b5881f0b3917bca4e255ce6b25b",
  bridgeAdmin: "0xf3c78dd3c49de3ddc4a783f1280a7f11e86cb202e1daa23df134adb0094fc292",
  oapp: "0x25a4c1a268dd726067558c8eddac5ef624b2507336ecec7d4ac1fd4553cbd789",
  admin: "0x836af3f2cae2244fad88568943692dfd87cd4eb07344edb20b74ba46a1bc93c4",
  oappPackage: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24",
  endpoint: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
  endpointPackage: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac",
  uln: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
  ulnPackage: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
  channel: "0x2b8072647e1c9fa38a020058285c10aaaed463be1b90831f63ea8a6e862cccee",
  nft: "0xc07d792d3700dea38f695d843f7eefa2e9c81efdf8aaf7da5fd151e4c58ef26c",
  executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989",
  dvns: ["0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb", "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685", "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91", "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"],
  receiveCallId: "64202616f75a5614acfa264418258521299eb6a892eeeea392feef8948c7eb53",
  remoteEid: 30102,
  graphql: "https://graphql.mainnet.sui.io/graphql",
  key: "nftree-sui-config-v1-2f3671d4"
}), Yp = "5bmbJkDF9Z8EAkSbHeq2G7dXhPPjvFZ1gJ5yf5Jam4Pc", Zp = "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef", Hp = "1058683488", qp = "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3", Bn = {
  registrationDigest: Yp,
  messagingChannel: Zp,
  messagingChannelInitialSharedVersion: Hp,
  endpointRegistryEntry: qp
}, Xp = A.enum("Argument", { ID: A.vector(A.u8()), Object: A.Address, Pure: A.vector(A.u8()), NestedResult: A.struct("NestedResult", { call_index: A.u16(), result_index: A.u16() }) }), Kp = A.vector(A.struct("MoveCall", { function: A.struct("Function", { package: A.Address, module_name: A.string(), name: A.string() }), arguments: A.vector(Xp), type_arguments: A.vector(A.string()), is_builder_call: A.bool(), result_ids: A.vector(A.vector(A.u8())) })), e4 = A.struct("OAppInfoV1", { oapp_object: A.Address, next_nonce_info: A.vector(A.u8()), lz_receive_info: A.vector(A.u8()), extra_info: A.vector(A.u8()) }), ci = A.struct("OAppUlnConfig", { use_default_confirmations: A.bool(), use_default_required_dvns: A.bool(), use_default_optional_dvns: A.bool(), uln_config: A.struct("UlnConfig", { confirmations: A.u64(), required_dvns: A.vector(A.Address), optional_dvns: A.vector(A.Address), optional_dvn_threshold: A.u8() }) }), t4 = A.struct("ExecutorConfig", { max_message_size: A.u64(), executor: A.Address }), k = Object.freeze({ ...c0, admin: c0.oappAdmin, vaultAdmin: c0.admin, uln: Yt.uln, ulnPackage: Yt.ulnPackage, executor: Yt.executor, receiveCallId: Yt.receiveCallId, channel: Bn.messagingChannel, channelVersion: Bn.messagingChannelInitialSharedVersion, registration: Bn.endpointRegistryEntry, registrationDigest: Bn.registrationDigest, remoteEid: 30102, dvns: Object.freeze(Yt.dvns.slice(0, 3)), key: "nftree-original-sui-config-v2-ac73072b" }), Ce = (e) => JSON.stringify(e, (t, n) => n && typeof n == "object" && !Array.isArray(n) ? Object.fromEntries(Object.entries(n).sort(([a], [s]) => a.localeCompare(s))) : n), $t = (e) => ({ use_default_confirmations: !1, use_default_required_dvns: !1, use_default_optional_dvns: !1, uln_config: { confirmations: String(e), required_dvns: [...k.dvns], optional_dvns: [], optional_dvn_threshold: 0 } });
function Zo() {
  const e = [{ function: { package: k.package, module_name: "vault", name: "lz_receive" }, arguments: [{ Object: k.vault }, { Object: k.oapp }, { ID: Array.from(Uint8Array.from(k.receiveCallId.match(/../g), (t) => parseInt(t, 16))) }], type_arguments: [k.nftType], is_builder_call: !1, result_ids: [] }];
  return Uint8Array.from([0, 1, ...e4.serialize({ oapp_object: k.oapp, next_nonce_info: [], lz_receive_info: [0, 1, ...Kp.serialize(e).toBytes()], extra_info: [] }).toBytes()]);
}
const Ho = () => btoa(String.fromCharCode(...Zo()));
function n4(e, t) {
  if ((e == null ? void 0 : e.toLowerCase()) !== k.sender) throw Error("Select your Sui dev wallet ending 45c4.");
  const n = new ga();
  n.setSender(k.sender);
  const a = n.sharedObjectRef({ objectId: k.oapp, initialSharedVersion: "1", mutable: !1 }), s = n.objectRef({ objectId: k.admin, version: String(t.admin.version), digest: t.admin.digest }), r = n.sharedObjectRef({ objectId: k.endpoint, initialSharedVersion: "635685314", mutable: !0 }), i = n.sharedObjectRef({ objectId: k.uln, initialSharedVersion: "635685319", mutable: !0 }), c = (o, d) => n.moveCall({ target: k.oappPackage + "::endpoint_calls::" + o, arguments: [a, s, r, ...d] });
  c("set_send_library", [n.pure.u32(k.remoteEid), n.pure.address(k.ulnPackage)]), c("set_receive_library", [n.pure.u32(k.remoteEid), n.pure.address(k.ulnPackage), n.pure.u64(0), n.object.clock()]);
  for (const [o, d] of [[1, t4.serialize({ max_message_size: "10000", executor: k.executor }).toBytes()], [2, ci.serialize($t(5)).toBytes()], [3, ci.serialize($t(20)).toBytes()]]) {
    const u = c("set_config", [n.pure.address(k.ulnPackage), n.pure.u32(k.remoteEid), n.pure.u32(o), n.pure.vector("u8", Array.from(d))]);
    n.moveCall({ target: k.ulnPackage + "::uln_302::set_config", arguments: [i, u] });
  }
  return c("set_oapp_info", [n.pure.vector("u8", Array.from(Zo()))]), n;
}
const da = "address version digest owner{__typename ... on Shared{initialSharedVersion} ... on AddressOwner{address{address}}} asMoveObject{contents{type{repr} json}}", jn = btoa(String.fromCharCode(...Uint8Array.from((k.package.slice(2) + "96750000").match(/../g), (e) => parseInt(e, 16)))), ht = Object.freeze({ libraries: ["0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01", "u32", "lnUAAA=="], send: ["0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5", "u32", "lnUAAA=="], receive: ["0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835", "u32", "lnUAAA=="], executor: ["0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4", "u32", "lnUAAA=="], appLibraries: ["0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920", k.endpointPackage + "::message_lib_manager::OAppConfigKey", jn], appSend: ["0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60", k.ulnPackage + "::send_uln::OAppConfigKey", jn], appReceive: ["0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09", k.ulnPackage + "::receive_uln::OAppConfigKey", jn], appExecutor: ["0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181", k.ulnPackage + "::send_uln::OAppConfigKey", jn] }), a4 = "query { checkpoint{sequenceNumber timestamp} " + Object.entries({ endpoint: k.endpoint, uln: k.uln, oapp: k.oapp, admin: k.admin, vault: k.vault, channel: k.channel, registration: k.registration }).map(([e, t]) => e + ':object(address:"' + t + '"){' + da + "}").join(" ") + " " + Object.entries(ht).map(([e, [t, n, a]]) => e + ':address(address:"' + t + '"){dynamicField(name:{type:"' + n + '",bcs:"' + a + '"}){value{... on MoveValue{json}}}}').join(" ") + "}", s4 = {
  sequenceNumber: 346346068,
  timestamp: "2026-11-17T21:43:14.400Z"
}, r4 = {
  address: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
  version: 1058683488,
  digest: "81g2B8TromnKru2ns5nJ1vySThSn3dajib39968TvpaK",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685314
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::endpoint_v2::EndpointV2"
      },
      json: {
        id: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
        eid: 30378,
        call_cap: {
          id: "0x8de954b904b90f887ff2e81ff3362ca89e883da6529e55723758cd5093234b0d",
          cap_type: {
            "@variant": "Package",
            pos0: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac"
          }
        },
        oapp_registry: {
          oapps: {
            id: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec",
            size: "142"
          }
        },
        composer_registry: {
          composers: {
            id: "0xb41ca35805177b946bebf5d339712b4e9bb562b068b33851001f9f0b66847814",
            size: "7"
          }
        },
        message_lib_manager: {
          registry: {
            libs: {
              contents: {
                id: "0x520bbc08883e22efb29f50283e25b4561ffa7c7b9d7774b14fc1c6272e593e03",
                size: "2"
              }
            },
            lib_to_type: {
              id: "0xb136bb2fc780a76e636c10f10b10ab33754a3573efa5f1285bf2b35eaf73b50d",
              size: "2"
            }
          },
          default_configs: {
            id: "0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01",
            size: "126"
          },
          oapp_configs: {
            id: "0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920",
            size: "99"
          }
        }
      }
    }
  }
}, i4 = {
  address: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
  version: 1089269256,
  digest: "DzVkeRqutE4WSvWs3Zy8GszAUzDgL6na6nUWhuco5Tff",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685319
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0::uln_302::Uln302"
      },
      json: {
        id: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
        call_cap: {
          id: "0xfacd801d08e3a99c907148fa00ec5f17a0a3ac831dbc95bcd75e601006caafa9",
          cap_type: {
            "@variant": "Package",
            pos0: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0"
          }
        },
        send_uln: {
          default_executor_configs: {
            id: "0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4",
            size: "126"
          },
          default_uln_configs: {
            id: "0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5",
            size: "126"
          },
          oapp_executor_configs: {
            id: "0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181",
            size: "53"
          },
          oapp_uln_configs: {
            id: "0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60",
            size: "213"
          }
        },
        receive_uln: {
          default_uln_configs: {
            id: "0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835",
            size: "126"
          },
          oapp_uln_configs: {
            id: "0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09",
            size: "238"
          },
          verification: "0x950f66ed27ec0a01a52bda147d74165d4cc20165f0cee0ecae6aaacde13d7741"
        }
      }
    }
  }
}, c4 = {
  address: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
  version: 1,
  digest: "8R9QHNRB56XjLsAD9UvZYWt7SELmp2JwBBFiWFwgpjxZ",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::OApp"
      },
      json: {
        id: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        oapp_cap: {
          id: "0x4c2a287a86396e551314b63a9fae3d52dd3ee421a53dc4f71c9ba4c3163940c1",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        admin_cap: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
        peer: {
          peers: {
            id: "0x9c95e9766e547812fadec00b162dbc7e42e02ebad066bea5bd826c4ae236d913",
            size: "0"
          }
        },
        enforced_options: {
          options: {
            id: "0x827e88b47ff80edbd92a5490c9a9e2784faf984d08dae2d21c93d35c5f7a56d1",
            size: "0"
          }
        },
        sending_call: null
      }
    }
  }
}, o4 = {
  address: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
  version: 1,
  digest: "8U9jtqkdQ9QasCfS8TbHFwfHzHN6SPVJ52pVckw2SFy7",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::AdminCap"
      },
      json: {
        id: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e"
      }
    }
  }
}, d4 = {
  address: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
  version: 2,
  digest: "AxGpY4PqrY5q4rn44ynuoEhEMKsgum1oNum8UCoaacCm",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 2
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Vault<0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT>"
      },
      json: {
        id: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        version: "1",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        cap: {
          id: "0xfda64d5d7047727e9b6ada8e8cf591c2acf3e70529f475de81269ff18f126d80",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        nft: null,
        backing: {
          bytes: "BG2iqeFb2CK6BJHZeJR8wb+x/TDm+BOl+xC5srHWpro="
        },
        route: {
          bytes: "Rb8ISZeE6p/2WJNxZalEnVCao33kenKK9E6QM4fzyiw="
        },
        peer: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        bound: !1,
        paused: !1,
        phase: 0,
        announced: !1,
        ack_sent: !1,
        request: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        recipient: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        }
      }
    }
  }
}, f4 = {
  address: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
  version: 1058683488,
  digest: "CuwjPYD9RTKrF9dXcVUd7SPHzWBWbuxGBFZSDLBHrjKd",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1058683488
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::messaging_channel::MessagingChannel"
      },
      json: {
        id: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
        oapp: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        channels: {
          id: "0xdd1e3f1024b36740b6c1ef8cc120e88f7b61127e665e7069ee3005985cad2c0a",
          size: "0"
        },
        is_sending: !1
      }
    }
  }
}, u4 = {
  address: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
  version: 1058683488,
  digest: "3UNWHJeLNi6xkvzMem8EsAXJRgYQS3Xh5ohfnuXg816q",
  owner: {
    __typename: "ObjectOwner"
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_field::Field<address,0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::oapp_registry::OAppRegistration>"
      },
      json: {
        id: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
        name: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        value: {
          messaging_channel: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
          oapp_info: "",
          delegate: "0x0000000000000000000000000000000000000000000000000000000000000000"
        }
      }
    }
  }
}, l4 = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, b4 = {
  dynamicField: {
    value: {
      json: {
        confirmations: "5",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, p4 = {
  dynamicField: {
    value: {
      json: {
        confirmations: "20",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, m4 = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, g4 = {
  dynamicField: null
}, h4 = {
  dynamicField: null
}, A4 = {
  dynamicField: null
}, y4 = {
  dynamicField: null
}, Nt = {
  checkpoint: s4,
  endpoint: r4,
  uln: i4,
  oapp: c4,
  admin: o4,
  vault: d4,
  channel: f4,
  registration: u4,
  libraries: l4,
  send: b4,
  receive: p4,
  executor: m4,
  appLibraries: g4,
  appSend: h4,
  appReceive: A4,
  appExecutor: y4
}, A0 = (e, t) => {
  if (!e) throw Error(t);
}, ee = (e, t, n) => A0(Ce(e) === Ce(t), n), qe = (e) => {
  var t, n;
  return (n = (t = e == null ? void 0 : e.asMoveObject) == null ? void 0 : t.contents) == null ? void 0 : n.json;
}, w4 = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/, ys = ["appLibraries", "appExecutor", "appSend", "appReceive"], Ga = Object.freeze(Object.fromEntries(ys.map((e) => {
  const [t, n, a] = ht[e], [s, r, i] = n.split("::");
  return [e, { id: In(t, { struct: { address: s, module: r, name: i, typeParams: [] } }, Uint8Array.from(atob(a), (c) => c.charCodeAt(0))), parent: t }];
})));
function T4(e, t = 0) {
  var r, i;
  A0(t === 0 || t === 1, "Unknown route configuration stage.");
  for (const c of ["endpoint", "uln", "oapp", "admin", "vault", "channel", "registration"]) {
    const o = e[c], d = Nt[c];
    A0((o == null ? void 0 : o.address) === d.address, "Wrong " + c + " object."), ee(o.owner, d.owner, c + " ownership changed."), ee((i = (r = o.asMoveObject) == null ? void 0 : r.contents) == null ? void 0 : i.type, d.asMoveObject.contents.type, c + " type changed.");
  }
  for (const c of ["oapp", "admin", "vault", "channel"]) ee(qe(e[c]), qe(Nt[c]), "Original " + c + " changed. Verify wallet activity.");
  const n = qe(e.endpoint), a = qe(e.uln);
  A0(n.eid === 30378, "Wrong endpoint ID."), ee(n.call_cap, qe(Nt.endpoint).call_cap, "Endpoint capability changed."), ee(a.call_cap, qe(Nt.uln).call_cap, "ULN capability changed.");
  for (const [c, o] of [[n.message_lib_manager.default_configs.id, ht.libraries[0]], [n.message_lib_manager.oapp_configs.id, ht.appLibraries[0]], [a.send_uln.oapp_executor_configs.id, ht.appExecutor[0]], [a.send_uln.oapp_uln_configs.id, ht.appSend[0]], [a.receive_uln.oapp_uln_configs.id, ht.appReceive[0]]]) A0(c === o, "Protocol configuration table changed.");
  for (const c of ["libraries", "executor", "send", "receive"]) ee(e[c], Nt[c], "Protocol default " + c + " changed. Review before continuing.");
  const s = structuredClone(qe(Nt.registration));
  t === 1 && (s.value.oapp_info = Ho()), ee(qe(e.registration), s, "Registration channel, metadata or delegate changed.");
  for (const c of ys) A0(e[c] && Object.hasOwn(e[c], "dynamicField"), "Missing " + c + " lookup.");
  if (t === 0)
    for (const c of ys) A0(e[c].dynamicField === null, "Application settings already exist. Check the configuration receipt.");
  else {
    const c = (o) => {
      var d, u;
      return (u = (d = e[o].dynamicField) == null ? void 0 : d.value) == null ? void 0 : u.json;
    };
    ee(c("appLibraries"), { send_lib: k.ulnPackage, receive_lib: k.ulnPackage, receive_lib_timeout: null }, "Application libraries differ."), ee(c("appExecutor"), { max_message_size: "10000", executor: k.executor }, "Application executor differs."), ee(c("appSend"), $t(5), "Application send security differs."), ee(c("appReceive"), $t(20), "Application receive security differs.");
  }
  return e;
}
const oi = (e) => JSON.parse(JSON.stringify(e, (t, n) => t === "$kind" || t === "type" ? void 0 : ["initialSharedVersion", "version"].includes(t) ? String(n) : n));
function v4(e) {
  var b, p, m, h, y, w, I, C, R, F, j, D, P, O, Q, $, v, q, b0;
  A0((e == null ? void 0 : e.$kind) === "Transaction" && ((p = (b = e.Transaction) == null ? void 0 : b.status) == null ? void 0 : p.success) === !0, "Route configuration did not succeed.");
  const t = e.Transaction;
  A0(((m = t.transaction) == null ? void 0 : m.sender) === k.sender && ((h = t.transaction.gasData) == null ? void 0 : h.owner) === k.sender, "Wrong sender or gas owner.");
  const n = (y = t.transaction.inputs) == null ? void 0 : y.flatMap((x) => {
    var G;
    return (G = x.Object) != null && G.ImmOrOwnedObject ? [x.Object.ImmOrOwnedObject] : [];
  });
  A0((n == null ? void 0 : n.length) === 1 && n[0].objectId === k.admin && /^[1-9][0-9]*$/.test(String(n[0].version)) && w4.test(n[0].digest), "Wrong OApp admin reference.");
  const a = n4(k.sender, { admin: n[0] }).getData();
  for (const x of ["commands", "inputs"]) ee(oi(t.transaction[x]), oi(a[x]), "Only the exact reviewed route configuration " + x + " are allowed.");
  const s = [
    [k.endpointPackage + "::message_lib_manager::SendLibrarySetEvent", { sender: k.package, dst_eid: 30102, new_lib: k.ulnPackage }],
    [k.endpointPackage + "::message_lib_manager::ReceiveLibrarySetEvent", { receiver: k.package, src_eid: 30102, new_lib: k.ulnPackage }],
    [k.endpointPackage + "::message_lib_manager::ReceiveLibraryTimeoutSetEvent", { receiver: k.package, src_eid: 30102, old_lib: "0x" + "0".repeat(64), expiry: "0" }],
    [k.ulnPackage + "::send_uln::ExecutorConfigSetEvent", { sender: k.package, dst_eid: 30102, config: { max_message_size: "10000", executor: k.executor } }],
    [k.ulnPackage + "::send_uln::UlnConfigSetEvent", { sender: k.package, dst_eid: 30102, config: $t(5) }],
    [k.ulnPackage + "::receive_uln::UlnConfigSetEvent", { receiver: k.package, src_eid: 30102, config: $t(20) }],
    [k.endpointPackage + "::oapp_registry::OAppInfoSetEvent", { oapp: k.package, oapp_info: Ho() }]
  ];
  ee((w = t.events) == null ? void 0 : w.map((x) => [x.eventType, x.json]), s, "Configuration events differ from the reviewed settings.");
  const r = (I = t.effects) == null ? void 0 : I.changedObjects;
  A0(Array.isArray(r), "Missing effects."), A0(!r.some((x) => [k.vault, k.nft, k.oapp, k.vaultAdmin, k.registry, k.channel, k.upgrade].filter(Boolean).includes(x.objectId)), "Protected NFT, Vault, OApp or channel changed.");
  const i = /* @__PURE__ */ new Set([(C = t.effects.gasObject) == null ? void 0 : C.objectId, ...(t.transaction.gasData.payment ?? []).map((x) => x.objectId)]), c = /* @__PURE__ */ new Set([k.admin, k.endpoint, k.uln, k.registration]);
  let o = /* @__PURE__ */ new Set();
  for (const x of r)
    if (x.inputState === "Exists")
      c.has(x.objectId) ? (o.add(x.objectId), A0(x.outputState === "ObjectWrite" && x.idOperation === "None", "Unexpected existing object operation."), x.objectId === k.admin ? A0(((R = x.inputOwner) == null ? void 0 : R.AddressOwner) === k.sender && ((F = x.outputOwner) == null ? void 0 : F.AddressOwner) === k.sender, "Admin authority moved.") : x.objectId === k.registration ? A0(((j = x.inputOwner) == null ? void 0 : j.ObjectOwner) === k.endpointRegistry && ((D = x.outputOwner) == null ? void 0 : D.ObjectOwner) === k.endpointRegistry, "Registration ownership changed.") : A0(String((O = (P = x.inputOwner) == null ? void 0 : P.Shared) == null ? void 0 : O.initialSharedVersion) === (x.objectId === k.endpoint ? "635685314" : "635685319") && String(($ = (Q = x.outputOwner) == null ? void 0 : Q.Shared) == null ? void 0 : $.initialSharedVersion) === (x.objectId === k.endpoint ? "635685314" : "635685319"), "Protocol ownership changed.")) : A0(i.has(x.objectId) && ((v = x.inputOwner) == null ? void 0 : v.AddressOwner) === k.sender, "Unexpected existing object mutation.");
    else if (x.outputState === "ObjectWrite") {
      const G = Object.values(Ga).find((E) => E.id === x.objectId);
      A0(G && x.idOperation === "Created" && ((q = x.outputOwner) == null ? void 0 : q.ObjectOwner) === G.parent, "Unexpected new configuration object.");
    } else A0(x.inputState === "DoesNotExist" && x.outputOwner === null && (x.outputState === "AccumulatorWriteV1" && x.idOperation === "None" || x.outputState === "DoesNotExist" && x.idOperation === "Created"), "Unexpected additional object effect.");
  A0(r.filter((x) => x.inputState === "DoesNotExist" && x.outputState === "DoesNotExist" && x.idOperation === "Created").length <= 3, "Unexpected ephemeral object count."), A0(o.size === c.size, "Missing reviewed configuration writes.");
  const d = r.filter((x) => x.inputState === "DoesNotExist" && x.outputState === "ObjectWrite");
  A0(d.length === 4 && Object.values(Ga).every((x) => d.some((G) => G.objectId === x.id)), "Expected exactly four application configuration entries.");
  const u = t.effects.gasUsed;
  A0(u, "Missing gas effects.");
  const l = BigInt(u.computationCost) + BigInt(u.storageCost) - BigInt(u.storageRebate);
  return A0(l > 0n && l <= 100000000n, "Gas exceeds the 0.1-SUI estimate ceiling."), A0(((b0 = t.balanceChanges) == null ? void 0 : b0.length) === 1 && t.balanceChanges[0].address === k.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -l, "Unexpected balance change."), { gasMist: String(l), channelId: k.channel, configuredEntries: Object.fromEntries(Object.entries(Ga).map(([x, G]) => [x, G.id])) };
}
const I4 = {
  sequenceNumber: 346361387,
  timestamp: "2026-11-17T22:44:46.374Z"
}, O4 = {
  address: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
  version: 1089269257,
  digest: "H6f3o8W3vwRQ2piaKwAbMb123qVBPk9SR4UmhoKbzvm6",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685314
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::endpoint_v2::EndpointV2"
      },
      json: {
        id: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
        eid: 30378,
        call_cap: {
          id: "0x8de954b904b90f887ff2e81ff3362ca89e883da6529e55723758cd5093234b0d",
          cap_type: {
            "@variant": "Package",
            pos0: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac"
          }
        },
        oapp_registry: {
          oapps: {
            id: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec",
            size: "142"
          }
        },
        composer_registry: {
          composers: {
            id: "0xb41ca35805177b946bebf5d339712b4e9bb562b068b33851001f9f0b66847814",
            size: "7"
          }
        },
        message_lib_manager: {
          registry: {
            libs: {
              contents: {
                id: "0x520bbc08883e22efb29f50283e25b4561ffa7c7b9d7774b14fc1c6272e593e03",
                size: "2"
              }
            },
            lib_to_type: {
              id: "0xb136bb2fc780a76e636c10f10b10ab33754a3573efa5f1285bf2b35eaf73b50d",
              size: "2"
            }
          },
          default_configs: {
            id: "0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01",
            size: "126"
          },
          oapp_configs: {
            id: "0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920",
            size: "100"
          }
        }
      }
    }
  }
}, E4 = {
  address: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
  version: 1089269257,
  digest: "AcckrdnV5VRmY8Ejt95EwQCMBFA7GFjwqpa5nmh3HuS9",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685319
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0::uln_302::Uln302"
      },
      json: {
        id: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
        call_cap: {
          id: "0xfacd801d08e3a99c907148fa00ec5f17a0a3ac831dbc95bcd75e601006caafa9",
          cap_type: {
            "@variant": "Package",
            pos0: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0"
          }
        },
        send_uln: {
          default_executor_configs: {
            id: "0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4",
            size: "126"
          },
          default_uln_configs: {
            id: "0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5",
            size: "126"
          },
          oapp_executor_configs: {
            id: "0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181",
            size: "54"
          },
          oapp_uln_configs: {
            id: "0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60",
            size: "214"
          }
        },
        receive_uln: {
          default_uln_configs: {
            id: "0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835",
            size: "126"
          },
          oapp_uln_configs: {
            id: "0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09",
            size: "239"
          },
          verification: "0x950f66ed27ec0a01a52bda147d74165d4cc20165f0cee0ecae6aaacde13d7741"
        }
      }
    }
  }
}, S4 = {
  address: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
  version: 1,
  digest: "8R9QHNRB56XjLsAD9UvZYWt7SELmp2JwBBFiWFwgpjxZ",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::OApp"
      },
      json: {
        id: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        oapp_cap: {
          id: "0x4c2a287a86396e551314b63a9fae3d52dd3ee421a53dc4f71c9ba4c3163940c1",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        admin_cap: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
        peer: {
          peers: {
            id: "0x9c95e9766e547812fadec00b162dbc7e42e02ebad066bea5bd826c4ae236d913",
            size: "0"
          }
        },
        enforced_options: {
          options: {
            id: "0x827e88b47ff80edbd92a5490c9a9e2784faf984d08dae2d21c93d35c5f7a56d1",
            size: "0"
          }
        },
        sending_call: null
      }
    }
  }
}, k4 = {
  address: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
  version: 1089269257,
  digest: "CD4yw8W8Qyu3wgPCwWjFJ71yavSaQmhdpYgSKdfUT1yK",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::AdminCap"
      },
      json: {
        id: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e"
      }
    }
  }
}, N4 = {
  address: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
  version: 2,
  digest: "AxGpY4PqrY5q4rn44ynuoEhEMKsgum1oNum8UCoaacCm",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 2
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Vault<0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT>"
      },
      json: {
        id: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        version: "1",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        cap: {
          id: "0xfda64d5d7047727e9b6ada8e8cf591c2acf3e70529f475de81269ff18f126d80",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        nft: null,
        backing: {
          bytes: "BG2iqeFb2CK6BJHZeJR8wb+x/TDm+BOl+xC5srHWpro="
        },
        route: {
          bytes: "Rb8ISZeE6p/2WJNxZalEnVCao33kenKK9E6QM4fzyiw="
        },
        peer: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        bound: !1,
        paused: !1,
        phase: 0,
        announced: !1,
        ack_sent: !1,
        request: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        recipient: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        }
      }
    }
  }
}, C4 = {
  address: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
  version: 1058683488,
  digest: "CuwjPYD9RTKrF9dXcVUd7SPHzWBWbuxGBFZSDLBHrjKd",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1058683488
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::messaging_channel::MessagingChannel"
      },
      json: {
        id: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
        oapp: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        channels: {
          id: "0xdd1e3f1024b36740b6c1ef8cc120e88f7b61127e665e7069ee3005985cad2c0a",
          size: "0"
        },
        is_sending: !1
      }
    }
  }
}, x4 = {
  address: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
  version: 1089269257,
  digest: "NVoFVPBULujFwR6gJrECtCiTS25JvWbTmd9LKuhMaR9",
  owner: {
    __typename: "ObjectOwner"
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_field::Field<address,0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::oapp_registry::OAppRegistration>"
      },
      json: {
        id: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
        name: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        value: {
          messaging_channel: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
          oapp_info: "AAEceUXklt3krTFC6/jVK5WUb07TRDVo3vqbl97DB8D50QDwAQABAaxzByuU8UqHsjeBxwBMd99nmf3uEJ8kJx1GlrxKZRSkBXZhdWx0Cmx6X3JlY2VpdmUDAUW/CEmXhOqf9liTcWWpRJ1QmqN95HpyivROkDOH88osARx5ReSW3eStMULr+NUrlZRvTtNENWje+puX3sMHwPnRACBkICYW91pWFKz6JkQYJYUhKZ62qJLu7qOS/u+JSMfrUwFTMHhmNmM2ZDQzOWVhMGRhMmYzZTliYTc5ZTQ5OTJhN2E0YzExMzIxNWZiZjU0YzQ0MmFjOTAyMGMzMTVmOTUzNzA1Ojpjb2xsZWN0aW9uOjpORlQAAAA=",
          delegate: "0x0000000000000000000000000000000000000000000000000000000000000000"
        }
      }
    }
  }
}, _4 = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, B4 = {
  dynamicField: {
    value: {
      json: {
        confirmations: "5",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, j4 = {
  dynamicField: {
    value: {
      json: {
        confirmations: "20",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, M4 = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, R4 = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, D4 = {
  dynamicField: {
    value: {
      json: {
        use_default_confirmations: !1,
        use_default_required_dvns: !1,
        use_default_optional_dvns: !1,
        uln_config: {
          confirmations: "5",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  }
}, U4 = {
  dynamicField: {
    value: {
      json: {
        use_default_confirmations: !1,
        use_default_required_dvns: !1,
        use_default_optional_dvns: !1,
        uln_config: {
          confirmations: "20",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  }
}, P4 = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, V4 = {
  address: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
  version: 2,
  digest: "6dLNdxRWrpZdVjyq8YTqYq7bTvWQqnJVqx4qM3DPFD4y",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Registry"
      },
      json: {
        id: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        version: "1",
        cap: null,
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        slot: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        backing: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
        nft_type: "ZjZjNmQ0MzllYTBkYTJmM2U5YmE3OWU0OTkyYTdhNGMxMTMyMTVmYmY1NGM0NDJhYzkwMjBjMzE1Zjk1MzcwNTo6Y29sbGVjdGlvbjo6TkZU"
      }
    }
  }
}, F4 = {
  address: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
  version: 1058683488,
  digest: "AFLwJ2uMtTgtn9CiiMMfAh3fmVQX18zWrXYn7oYnksZW",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::AdminCap"
      },
      json: {
        id: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92"
      }
    }
  }
}, $4 = {
  address: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
  version: 1,
  digest: "BCKc8Pq2jvGbyqpSgUWdHaXN9LZSqaurHFZwp6tNuzvH",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap"
      },
      json: {
        id: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
        package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        version: "1",
        policy: 0
      }
    }
  }
}, L4 = {
  address: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
  version: 986499448,
  digest: "HXroMY2h1sVdUcu71aVxXYiSEtEsGFmAEaNMVX8DscEt",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT"
      },
      json: {
        id: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
        number: "2720",
        name: "Tree NFT #2720",
        description: "A unique tree from the Tree NFT collection. Rarity: Common",
        image_url: "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieozgvnr7qc4ghsq36zwssuhj7xahuznjlmu6g63clnyt37hjsi4m/2720.jpg",
        rarity: "Common"
      }
    }
  }
}, Pe = {
  checkpoint: I4,
  endpoint: O4,
  uln: E4,
  oapp: S4,
  admin: k4,
  vault: N4,
  channel: C4,
  registration: x4,
  libraries: _4,
  send: B4,
  receive: j4,
  executor: M4,
  appLibraries: R4,
  appSend: D4,
  appReceive: U4,
  appExecutor: P4,
  registry: V4,
  vaultAdmin: F4,
  upgrade: $4,
  nft: L4
}, z4 = "9tBTVYhDGMhrGstVxGVMzmhTfyYGQnQhZ7paPkPcVmg2", G4 = "0x90b5292a5074CfDD665C726b433cc0A97e0dA6ab", W4 = "0x1d3da001E586a7DEFD397B77FADB29eD6F039c13", Q4 = "AfupAmEkVCxA9uXWL6v42yopXtM6zpgt7dcYjx5Ei6QZ", J4 = "5bmbJkDF9Z8EAkSbHeq2G7dXhPPjvFZ1gJ5yf5Jam4Pc", Y4 = "EFmDHsBSjkydv26Ajc8pvR9GFuNNmubo9tPjfrnc6Eos", At = {
  publicationDigest: z4,
  bnbAdapter: G4,
  bnbPass: W4,
  slotDigest: Q4,
  registrationDigest: J4,
  suiConfigurationDigest: Y4
}, M = Object.freeze({ ...k, utilsPackage: "0x00245ba36f7a1cc643a2b037450dff1e4399e18069c6545fb5fcaaf37d39d7dc", adapter: At.bnbAdapter, pass: At.bnbPass, peer: "0x" + At.bnbAdapter.slice(2).toLowerCase().padStart(64, "0"), key: "nftree-original-sui-peer-v1-90b5292a", maxGasMist: 100000000n }), gt = (e, t) => {
  if (!e) throw Error(t);
}, ne = (e) => {
  var t, n;
  return (n = (t = e == null ? void 0 : e.asMoveObject) == null ? void 0 : t.contents) == null ? void 0 : n.json;
}, zs = (e) => btoa(String.fromCharCode(...e)), Gs = (e) => Uint8Array.from(e.replace(/^0x/, "").match(/../g), (t) => parseInt(t, 16)), tn = { bytes: zs(Gs(M.peer)) }, Z4 = "00030100110100000000000000000000000000030d40", Ws = zs(Gs(Z4)), Wa = ne(Pe.oapp), H4 = ne(Pe.channel), Mn = A.u32().serialize(30102).toBytes(), q4 = { peerEntry: [Wa.peer.peers.id, "u32", Mn], reserveOptions: [Wa.enforced_options.options.id, M.oappPackage + "::enforced_options::EnforcedOptionsKey", Uint8Array.from([...Mn, 1, 0])], ackOptions: [Wa.enforced_options.options.id, M.oappPackage + "::enforced_options::EnforcedOptionsKey", Uint8Array.from([...Mn, 3, 0])], channelPath: [H4.channels.id, M.endpointPackage + "::messaging_channel::ChannelKey", Uint8Array.from([...Mn, 32, ...Gs(M.peer)])] }, X4 = (e) => {
  if (e === "u32") return { u32: null };
  const [t, n, a] = e.split("::");
  return { struct: { address: t, module: n, name: a, typeParams: [] } };
}, Ae = Object.freeze(Object.fromEntries(Object.entries(q4).map(([e, [t, n, a]]) => [e, { parent: t, type: n, bcs: zs(a), id: In(t, X4(n), a) }]))), K4 = a4.slice(0, -1) + " " + Object.entries({ registry: M.registry, vaultAdmin: M.vaultAdmin, upgrade: M.upgrade, nft: M.nft }).map(([e, t]) => e + ':object(address:"' + t + '"){' + da + "}").join(" ") + " " + Object.entries(Ae).map(([e, t]) => e + ':address(address:"' + t.parent + '"){dynamicField(name:{type:"' + t.type + '",bcs:"' + t.bcs + '"}){value{... on MoveValue{json}}}}').join(" ") + "}", e3 = K4.replaceAll(da, "...PeerObject") + " fragment PeerObject on Object {" + da + "}", Xe = (e, t, n) => gt(Ce(e) === Ce(t), n);
function ws(e, t = 0) {
  var a, s, r, i;
  gt(t === 0 || t === 1, "Unknown peer binding stage.");
  for (const c of ["oapp", "vault", "channel", "registry", "vaultAdmin", "upgrade", "nft"]) {
    const o = e[c], d = Pe[c];
    gt((o == null ? void 0 : o.address) === d.address, "Wrong " + c + " object."), Xe(o.owner, d.owner, c + " ownership changed."), Xe((s = (a = o.asMoveObject) == null ? void 0 : a.contents) == null ? void 0 : s.type, d.asMoveObject.contents.type, c + " type changed.");
  }
  for (const c of ["registry", "vaultAdmin", "upgrade", "nft"]) Xe(ne(e[c]), ne(Pe[c]), "Protected " + c + " contents changed.");
  for (const c of ["registry", "upgrade", "nft"])
    gt(String(e[c].version) === String(Pe[c].version) && e[c].digest === Pe[c].digest, "Protected " + c + " version/digest changed.");
  for (const c of ["oapp", "vault", "channel"]) {
    const o = structuredClone(ne(Pe[c]));
    t === 1 && (c === "oapp" ? (o.peer.peers.size = "1", o.enforced_options.options.size = "2") : c === "vault" ? (o.bound = !0, o.peer = tn) : o.channels.size = "1"), Xe(ne(e[c]), o, "Unexpected " + c + " peer state.");
  }
  const n = structuredClone(e);
  for (const c of ["oapp", "vault", "channel"]) n[c].asMoveObject.contents.json = structuredClone(ne(Pe[c]));
  T4(n, 1);
  for (const c of Object.keys(Ae)) gt(e[c] && Object.hasOwn(e[c], "dynamicField"), "Missing " + c + " lookup.");
  if (t === 0)
    for (const c of Object.keys(Ae)) gt(e[c].dynamicField === null, "Peer or enforced options already set. Check the binding receipt.");
  else {
    const c = (d) => {
      var u, l;
      return (l = (u = e[d].dynamicField) == null ? void 0 : u.value) == null ? void 0 : l.json;
    };
    Xe(c("peerEntry"), tn, "Wrong explicit BNB peer.");
    for (const d of ["reserveOptions", "ackOptions"]) Xe(c(d), Ws, "Wrong " + d + " execution policy.");
    const o = c("channelPath");
    gt((o == null ? void 0 : o.outbound_nonce) === "0" && (o == null ? void 0 : o.lazy_inbound_nonce) === "0" && ((r = o == null ? void 0 : o.inbound_payload_hashes) == null ? void 0 : r.size) === "0" && /^0x[0-9a-f]{64}$/.test(((i = o == null ? void 0 : o.inbound_payload_hashes) == null ? void 0 : i.id) ?? "") && !/^0x0+$/.test(o.inbound_payload_hashes.id), "Channel already used or incorrect."), Xe(Object.keys(o).sort(), ["inbound_payload_hashes", "lazy_inbound_nonce", "outbound_nonce"], "Unexpected channel fields."), Xe(Object.keys(o.inbound_payload_hashes).sort(), ["id", "size"], "Unexpected inbound table fields.");
  }
  return e;
}
Object.freeze({ ...it, key: "nftree-original-bnb-config-v1-90b5292a", maxAge: 12e4 });
const N0 = (e, t) => {
  if (!e) throw Error(t);
}, di = (e, t, n) => N0(Ce(e) === Ce(t), n), t3 = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
function n3(e, t) {
  N0((e == null ? void 0 : e.toLowerCase()) === M.sender, "Select the Sui dev wallet ending 45c4."), ws(t, 0);
  const n = new ga();
  n.setSender(M.sender);
  const a = n.moveCall({ target: M.utilsPackage + "::bytes32::from_address", arguments: [n.pure.address(M.peer)] });
  return n.moveCall({ target: M.package + "::vault::bind", typeArguments: [M.nftType], arguments: [n.sharedObjectRef({ objectId: M.vault, initialSharedVersion: "2", mutable: !0 }), n.objectRef({ objectId: M.vaultAdmin, version: String(t.vaultAdmin.version), digest: t.vaultAdmin.digest }), n.sharedObjectRef({ objectId: M.oapp, initialSharedVersion: "1", mutable: !0 }), n.objectRef({ objectId: M.admin, version: String(t.admin.version), digest: t.admin.digest }), n.sharedObjectRef({ objectId: M.endpoint, initialSharedVersion: "635685314", mutable: !1 }), n.sharedObjectRef({ objectId: M.channel, initialSharedVersion: M.channelVersion, mutable: !0 }), a] }), n;
}
const fi = (e) => JSON.parse(JSON.stringify(e, (t, n) => t === "$kind" || t === "type" ? void 0 : ["initialSharedVersion", "version"].includes(t) ? String(n) : n));
function a3(e) {
  var h, y, w, I, C, R, F, j, D, P, O, Q, $, v, q, b0, x, G;
  N0((e == null ? void 0 : e.$kind) === "Transaction" && ((y = (h = e.Transaction) == null ? void 0 : h.status) == null ? void 0 : y.success) === !0, "Peer binding did not succeed.");
  const t = e.Transaction;
  N0(((w = t.transaction) == null ? void 0 : w.sender) === M.sender && ((I = t.transaction.gasData) == null ? void 0 : I.owner) === M.sender, "Wrong sender or gas owner.");
  const n = (C = t.transaction.inputs) == null ? void 0 : C.flatMap((E) => {
    var p0;
    return (p0 = E.Object) != null && p0.ImmOrOwnedObject ? [E.Object.ImmOrOwnedObject] : [];
  });
  N0((n == null ? void 0 : n.length) === 2 && n.every((E) => [M.vaultAdmin, M.admin].includes(E.objectId) && /^[1-9][0-9]*$/.test(String(E.version)) && t3.test(E.digest)) && new Set(n.map((E) => E.objectId)).size === 2, "Wrong admin object references.");
  const a = structuredClone(Pe);
  for (const E of n) Object.assign(a[E.objectId === M.vaultAdmin ? "vaultAdmin" : "admin"], { version: String(E.version), digest: E.digest });
  for (const E of Object.keys(Ae)) a[E] = { dynamicField: null };
  const s = n3(M.sender, a).getData();
  for (const E of ["commands", "inputs"]) di(fi(t.transaction[E]), fi(s[E]), "Only the exact original peer-binding " + E + " are allowed.");
  const r = [
    [M.endpointPackage + "::messaging_channel::ChannelInitializedEvent", { local_oapp: M.package, remote_eid: 30102, remote_oapp: tn }],
    [M.oappPackage + "::oapp_peer::PeerSetEvent", { oapp: M.package, eid: 30102, peer: tn }],
    ...[1, 3].map((E) => [M.oappPackage + "::enforced_options::EnforcedOptionSetEvent", { oapp: M.package, eid: 30102, msg_type: E, options: Ws }]),
    [M.package + "::vault::Bound", { vault: M.vault, peer: tn }]
  ];
  di((R = t.events) == null ? void 0 : R.map((E) => [E.eventType, E.json]), r, "Peer, channel or enforced-options events differ.");
  const i = (F = t.effects) == null ? void 0 : F.changedObjects;
  N0(Array.isArray(i), "Missing binding effects.");
  const c = /* @__PURE__ */ new Map([[M.vault, "2"], [M.oapp, "1"], [M.channel, M.channelVersion]]), o = /* @__PURE__ */ new Set([M.vaultAdmin, M.admin]), d = /* @__PURE__ */ new Set([...c.keys(), ...o]), u = /* @__PURE__ */ new Set([(j = t.effects.gasObject) == null ? void 0 : j.objectId, ...(t.transaction.gasData.payment ?? []).map((E) => E.objectId)]), l = /* @__PURE__ */ new Set();
  N0(!i.some((E) => [M.nft, M.registry, M.upgrade, M.endpoint, M.uln, M.registration].includes(E.objectId)), "Protected NFT, Registry, upgrade authority or protocol settings changed.");
  for (const E of i)
    if (E.inputState === "Exists")
      d.has(E.objectId) ? (l.add(E.objectId), N0(E.outputState === "ObjectWrite" && E.idOperation === "None", "Unexpected existing object operation."), o.has(E.objectId) ? N0(((D = E.inputOwner) == null ? void 0 : D.AddressOwner) === M.sender && ((P = E.outputOwner) == null ? void 0 : P.AddressOwner) === M.sender, "Admin capability moved.") : N0(String((Q = (O = E.inputOwner) == null ? void 0 : O.Shared) == null ? void 0 : Q.initialSharedVersion) === c.get(E.objectId) && String((v = ($ = E.outputOwner) == null ? void 0 : $.Shared) == null ? void 0 : v.initialSharedVersion) === c.get(E.objectId), "Shared ownership changed.")) : N0(u.has(E.objectId) && ((q = E.inputOwner) == null ? void 0 : q.AddressOwner) === M.sender, "Unexpected existing object mutation.");
    else if (E.outputState === "ObjectWrite") {
      const p0 = Object.values(Ae).find((J) => J.id === E.objectId);
      N0(p0 && E.idOperation === "Created" && ((b0 = E.outputOwner) == null ? void 0 : b0.ObjectOwner) === p0.parent, "Unexpected new binding entry.");
    } else N0(E.inputState === "DoesNotExist" && E.outputOwner === null && (E.outputState === "AccumulatorWriteV1" && E.idOperation === "None" || E.outputState === "DoesNotExist" && E.idOperation === "Created"), "Unexpected additional object effect.");
  N0(l.size === d.size, "Missing binding writes.");
  const b = i.filter((E) => E.inputState === "DoesNotExist" && E.outputState === "ObjectWrite");
  N0(b.length === 4 && Object.values(Ae).every((E) => b.some((p0) => p0.objectId === E.id)), "Expected exactly four derived binding entries."), N0(i.filter((E) => E.inputState === "DoesNotExist" && E.outputState === "DoesNotExist" && E.idOperation === "Created").length <= 3, "Unexpected transient object count.");
  const p = (x = t.effects) == null ? void 0 : x.gasUsed;
  N0(p, "Missing gas effects.");
  const m = BigInt(p.computationCost) + BigInt(p.storageCost) - BigInt(p.storageRebate);
  return N0(m > 0n && m <= M.maxGasMist, "Gas exceeds the reviewed 0.1-SUI estimate ceiling."), N0(((G = t.balanceChanges) == null ? void 0 : G.length) === 1 && t.balanceChanges[0].address === M.sender && /^0x0*2::sui::SUI$/.test(t.balanceChanges[0].coinType) && BigInt(t.balanceChanges[0].amount) === -m, "Unexpected balance change."), { gasMist: String(m), channelId: M.channel, vaultId: M.vault, peer: M.peer, bindingEntries: Object.fromEntries(Object.entries(Ae).map(([E, p0]) => [E, p0.id])) };
}
async function s3(e) {
  _p(await e.core.getChainIdentifier({ signal: AbortSignal.timeout(3e4) }));
  const t = [[At.publicationDigest, Bp], [At.slotDigest, $p], [At.registrationDigest, Jp], [At.suiConfigurationDigest, v4]], n = await Promise.all(t.map(async ([a, s]) => {
    var i;
    const r = await e.core.getTransaction({ digest: a, include: { effects: !0, events: !0, transaction: !0, balanceChanges: !0, objectTypes: !0 }, signal: AbortSignal.timeout(3e4) });
    return N0(((i = r.Transaction) == null ? void 0 : i.digest) === a, "Wrong source receipt."), s(r);
  }));
  return N0(n[0].packageId === M.package && n[1].vaultId === M.vault && n[2].channelId === M.channel && n[3].channelId === M.channel, "Confirmed source bindings differ."), { status: "verified" };
}
const r3 = {
  sequenceNumber: 346371773,
  timestamp: "2026-11-17T23:26:28.590Z"
}, i3 = {
  address: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
  version: 1089269257,
  digest: "H6f3o8W3vwRQ2piaKwAbMb123qVBPk9SR4UmhoKbzvm6",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685314
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::endpoint_v2::EndpointV2"
      },
      json: {
        id: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
        eid: 30378,
        call_cap: {
          id: "0x8de954b904b90f887ff2e81ff3362ca89e883da6529e55723758cd5093234b0d",
          cap_type: {
            "@variant": "Package",
            pos0: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac"
          }
        },
        oapp_registry: {
          oapps: {
            id: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec",
            size: "142"
          }
        },
        composer_registry: {
          composers: {
            id: "0xb41ca35805177b946bebf5d339712b4e9bb562b068b33851001f9f0b66847814",
            size: "7"
          }
        },
        message_lib_manager: {
          registry: {
            libs: {
              contents: {
                id: "0x520bbc08883e22efb29f50283e25b4561ffa7c7b9d7774b14fc1c6272e593e03",
                size: "2"
              }
            },
            lib_to_type: {
              id: "0xb136bb2fc780a76e636c10f10b10ab33754a3573efa5f1285bf2b35eaf73b50d",
              size: "2"
            }
          },
          default_configs: {
            id: "0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01",
            size: "126"
          },
          oapp_configs: {
            id: "0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920",
            size: "100"
          }
        }
      }
    }
  }
}, c3 = {
  address: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
  version: 1089269257,
  digest: "AcckrdnV5VRmY8Ejt95EwQCMBFA7GFjwqpa5nmh3HuS9",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 635685319
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0::uln_302::Uln302"
      },
      json: {
        id: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
        call_cap: {
          id: "0xfacd801d08e3a99c907148fa00ec5f17a0a3ac831dbc95bcd75e601006caafa9",
          cap_type: {
            "@variant": "Package",
            pos0: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0"
          }
        },
        send_uln: {
          default_executor_configs: {
            id: "0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4",
            size: "126"
          },
          default_uln_configs: {
            id: "0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5",
            size: "126"
          },
          oapp_executor_configs: {
            id: "0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181",
            size: "54"
          },
          oapp_uln_configs: {
            id: "0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60",
            size: "214"
          }
        },
        receive_uln: {
          default_uln_configs: {
            id: "0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835",
            size: "126"
          },
          oapp_uln_configs: {
            id: "0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09",
            size: "239"
          },
          verification: "0x950f66ed27ec0a01a52bda147d74165d4cc20165f0cee0ecae6aaacde13d7741"
        }
      }
    }
  }
}, o3 = {
  address: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
  version: 1089269258,
  digest: "VdwgrsSrPBCt29tRR2sH7H7ut2YUA4Eb9L43idahLxL",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::OApp"
      },
      json: {
        id: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        oapp_cap: {
          id: "0x4c2a287a86396e551314b63a9fae3d52dd3ee421a53dc4f71c9ba4c3163940c1",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        admin_cap: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
        peer: {
          peers: {
            id: "0x9c95e9766e547812fadec00b162dbc7e42e02ebad066bea5bd826c4ae236d913",
            size: "1"
          }
        },
        enforced_options: {
          options: {
            id: "0x827e88b47ff80edbd92a5490c9a9e2784faf984d08dae2d21c93d35c5f7a56d1",
            size: "2"
          }
        },
        sending_call: null
      }
    }
  }
}, d3 = {
  address: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
  version: 1089269258,
  digest: "EjN4KdoP3XMuAzPQbEKnjQDuz2tP2K1orgagGtHyjaWb",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::AdminCap"
      },
      json: {
        id: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e"
      }
    }
  }
}, f3 = {
  address: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
  version: 1089269258,
  digest: "FaDXyQYPnE5qVXcRhoUnLBjAGPxBq6cfPvBhD8ejQB36",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 2
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Vault<0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT>"
      },
      json: {
        id: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        version: "1",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        cap: {
          id: "0xfda64d5d7047727e9b6ada8e8cf591c2acf3e70529f475de81269ff18f126d80",
          cap_type: {
            "@variant": "Package",
            pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
          }
        },
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        nft: null,
        backing: {
          bytes: "BG2iqeFb2CK6BJHZeJR8wb+x/TDm+BOl+xC5srHWpro="
        },
        route: {
          bytes: "Rb8ISZeE6p/2WJNxZalEnVCao33kenKK9E6QM4fzyiw="
        },
        peer: {
          bytes: "AAAAAAAAAAAAAAAAkLUpKlB0z91mXHJrQzzAqX4Npqs="
        },
        bound: !0,
        paused: !1,
        phase: 0,
        announced: !1,
        ack_sent: !1,
        request: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        },
        recipient: {
          bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        }
      }
    }
  }
}, u3 = {
  address: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
  version: 1089269258,
  digest: "46iexvc4YCLGQNtXuiAVedwqGcnmbUzpMKJmUfm5YV2a",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1058683488
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::messaging_channel::MessagingChannel"
      },
      json: {
        id: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
        oapp: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        channels: {
          id: "0xdd1e3f1024b36740b6c1ef8cc120e88f7b61127e665e7069ee3005985cad2c0a",
          size: "1"
        },
        is_sending: !1
      }
    }
  }
}, l3 = {
  address: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
  version: 1089269257,
  digest: "NVoFVPBULujFwR6gJrECtCiTS25JvWbTmd9LKuhMaR9",
  owner: {
    __typename: "ObjectOwner"
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_field::Field<address,0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::oapp_registry::OAppRegistration>"
      },
      json: {
        id: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
        name: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        value: {
          messaging_channel: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
          oapp_info: "AAEceUXklt3krTFC6/jVK5WUb07TRDVo3vqbl97DB8D50QDwAQABAaxzByuU8UqHsjeBxwBMd99nmf3uEJ8kJx1GlrxKZRSkBXZhdWx0Cmx6X3JlY2VpdmUDAUW/CEmXhOqf9liTcWWpRJ1QmqN95HpyivROkDOH88osARx5ReSW3eStMULr+NUrlZRvTtNENWje+puX3sMHwPnRACBkICYW91pWFKz6JkQYJYUhKZ62qJLu7qOS/u+JSMfrUwFTMHhmNmM2ZDQzOWVhMGRhMmYzZTliYTc5ZTQ5OTJhN2E0YzExMzIxNWZiZjU0YzQ0MmFjOTAyMGMzMTVmOTUzNzA1Ojpjb2xsZWN0aW9uOjpORlQAAAA=",
          delegate: "0x0000000000000000000000000000000000000000000000000000000000000000"
        }
      }
    }
  }
}, b3 = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, p3 = {
  dynamicField: {
    value: {
      json: {
        confirmations: "5",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, m3 = {
  dynamicField: {
    value: {
      json: {
        confirmations: "20",
        required_dvns: [
          "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
          "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
          "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
          "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
        ],
        optional_dvns: [],
        optional_dvn_threshold: 0
      }
    }
  }
}, g3 = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, h3 = {
  dynamicField: {
    value: {
      json: {
        send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
        receive_lib_timeout: null
      }
    }
  }
}, A3 = {
  dynamicField: {
    value: {
      json: {
        use_default_confirmations: !1,
        use_default_required_dvns: !1,
        use_default_optional_dvns: !1,
        uln_config: {
          confirmations: "5",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  }
}, y3 = {
  dynamicField: {
    value: {
      json: {
        use_default_confirmations: !1,
        use_default_required_dvns: !1,
        use_default_optional_dvns: !1,
        uln_config: {
          confirmations: "20",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  }
}, w3 = {
  dynamicField: {
    value: {
      json: {
        max_message_size: "10000",
        executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
      }
    }
  }
}, T3 = {
  address: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
  version: 2,
  digest: "6dLNdxRWrpZdVjyq8YTqYq7bTvWQqnJVqx4qM3DPFD4y",
  owner: {
    __typename: "Shared",
    initialSharedVersion: 1
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Registry"
      },
      json: {
        id: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
        version: "1",
        cap: null,
        oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        slot: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        backing: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
        nft_type: "ZjZjNmQ0MzllYTBkYTJmM2U5YmE3OWU0OTkyYTdhNGMxMTMyMTVmYmY1NGM0NDJhYzkwMjBjMzE1Zjk1MzcwNTo6Y29sbGVjdGlvbjo6TkZU"
      }
    }
  }
}, v3 = {
  address: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
  version: 1089269258,
  digest: "4Efe9yp7RFM7gCYFVrTAyGT9Ewt1z2aiKDZDCAetL5aj",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::AdminCap"
      },
      json: {
        id: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
        registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92"
      }
    }
  }
}, I3 = {
  address: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
  version: 1,
  digest: "BCKc8Pq2jvGbyqpSgUWdHaXN9LZSqaurHFZwp6tNuzvH",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap"
      },
      json: {
        id: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
        package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
        version: "1",
        policy: 0
      }
    }
  }
}, O3 = {
  address: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
  version: 986499448,
  digest: "HXroMY2h1sVdUcu71aVxXYiSEtEsGFmAEaNMVX8DscEt",
  owner: {
    __typename: "AddressOwner",
    address: {
      address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
    }
  },
  asMoveObject: {
    contents: {
      type: {
        repr: "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT"
      },
      json: {
        id: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
        number: "2720",
        name: "Tree NFT #2720",
        description: "A unique tree from the Tree NFT collection. Rarity: Common",
        image_url: "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieozgvnr7qc4ghsq36zwssuhj7xahuznjlmu6g63clnyt37hjsi4m/2720.jpg",
        rarity: "Common"
      }
    }
  }
}, E3 = {
  dynamicField: {
    value: {
      json: {
        bytes: "AAAAAAAAAAAAAAAAkLUpKlB0z91mXHJrQzzAqX4Npqs="
      }
    }
  }
}, S3 = {
  dynamicField: {
    value: {
      json: "AAMBABEBAAAAAAAAAAAAAAAAAAMNQA=="
    }
  }
}, k3 = {
  dynamicField: {
    value: {
      json: "AAMBABEBAAAAAAAAAAAAAAAAAAMNQA=="
    }
  }
}, N3 = {
  dynamicField: {
    value: {
      json: {
        outbound_nonce: "0",
        lazy_inbound_nonce: "0",
        inbound_payload_hashes: {
          id: "0x861288a8c14221c0922c3a7acb5c341bfc4a0c94c5c528858e7a2e2b95ae669b",
          size: "0"
        }
      }
    }
  }
}, ce = {
  checkpoint: r3,
  endpoint: i3,
  uln: c3,
  oapp: o3,
  admin: d3,
  vault: f3,
  channel: u3,
  registration: l3,
  libraries: b3,
  send: p3,
  receive: m3,
  executor: g3,
  appLibraries: h3,
  appSend: A3,
  appReceive: y3,
  appExecutor: w3,
  registry: T3,
  vaultAdmin: v3,
  upgrade: I3,
  nft: O3,
  peerEntry: E3,
  reserveOptions: S3,
  ackOptions: k3,
  channelPath: N3
}, C3 = "FCG2538WHkd7rTAiC2McJanEw2Dr84BiaGcXoNzZUwsu", ui = {
  suiPeerBindingDigest: C3
}, t0 = Object.freeze({ ...M, key: "nftree-original-deposit-v1-046da2a9", maxGasMist: 100000000n }), I0 = (e, t) => {
  if (!e) throw Error(t);
}, nn = (e, t, n) => I0(Ce(e) === Ce(t), n), x3 = (e) => e instanceof Uint8Array ? e : Uint8Array.from(Object.values(e)), li = (e) => JSON.parse(JSON.stringify(e, (t, n) => t === "$kind" || t === "type" ? void 0 : ["initialSharedVersion", "version"].includes(t) ? String(n) : n)), qo = () => ({ ...structuredClone(ne(ce.vault)), nft: structuredClone(ne(ce.nft)), phase: 1 });
function Xo(e, t = 0) {
  var a, s, r;
  if (t === 0) return ws(e, 1);
  I0(t === 1, "Unknown deposit stage."), I0(((a = e.vault) == null ? void 0 : a.address) === t0.vault, "Wrong deposit vault."), nn(e.vault.owner, ce.vault.owner, "Vault ownership changed."), nn((r = (s = e.vault.asMoveObject) == null ? void 0 : s.contents) == null ? void 0 : r.type, ce.vault.asMoveObject.contents.type, "Wrong vault type."), nn(ne(e.vault), qo(), "Only original #2720 may be held in the funded, unannounced vault."), I0(e.nft === null, "Deposited NFT must be wrapped, not independently live.");
  const n = structuredClone(e);
  return n.vault.asMoveObject.contents.json = structuredClone(ne(ce.vault)), n.nft = structuredClone(ce.nft), ws(n, 1), e;
}
function _3(e, t) {
  I0((e == null ? void 0 : e.toLowerCase()) === t0.sender, "Select the Sui dev wallet ending 45c4."), Xo(t, 0);
  const n = new ga();
  return n.setSender(t0.sender), n.moveCall({ target: t0.package + "::vault::fund", typeArguments: [t0.nftType], arguments: [n.sharedObjectRef({ objectId: t0.vault, initialSharedVersion: "2", mutable: !0 }), n.objectRef({ objectId: t0.vaultAdmin, version: String(t.vaultAdmin.version), digest: t.vaultAdmin.digest }), n.objectRef({ objectId: t0.nft, version: String(t.nft.version), digest: t.nft.digest })] }), n;
}
const B3 = A.struct("NFT", { id: A.Address, number: A.u64(), name: A.string(), description: A.string(), image_url: A.string(), rarity: A.string() }), j3 = A.struct("CallCap", { id: A.Address, cap_type: A.enum("CapType", { Individual: null, Package: A.Address }) }), M3 = A.struct("Vault", { id: A.Address, version: A.u64(), registry: A.Address, cap: j3, oapp: A.Address, nft: A.option(B3), backing: A.vector(A.u8()), route: A.vector(A.u8()), peer: A.vector(A.u8()), bound: A.bool(), paused: A.bool(), phase: A.u8(), announced: A.bool(), ack_sent: A.bool(), request: A.vector(A.u8()), recipient: A.vector(A.u8()) });
function R3() {
  const e = qo();
  e.cap.cap_type = { Package: e.cap.cap_type.pos0 };
  for (const t of ["backing", "route", "peer", "request", "recipient"]) e[t] = Array.from(atob(e[t].bytes), (n) => n.charCodeAt(0));
  return M3.serialize(e).toBytes();
}
function D3(e, t, { quote: n = !1 } = {}) {
  var u, l, b, p, m, h, y, w, I, C, R, F, j, D, P, O, Q, $;
  I0((e == null ? void 0 : e.$kind) === "Transaction" && ((l = (u = e.Transaction) == null ? void 0 : u.status) == null ? void 0 : l.success) === !0, "Deposit simulation or receipt failed.");
  const a = e.Transaction;
  I0(((b = a.transaction) == null ? void 0 : b.sender) === t0.sender && ((p = a.transaction.gasData) == null ? void 0 : p.owner) === t0.sender, "Wrong sender or gas owner.");
  for (const v of ["inputs", "commands"]) nn(li(a.transaction[v]), li(t.getData()[v]), "Unexpected deposit " + v + ".");
  nn((m = a.events) == null ? void 0 : m.map((v) => [v.eventType, v.json]), [[t0.package + "::vault::Funded", { vault: t0.vault, nft: ne(ce.vault).backing }]], "Expected exactly one original-NFT deposit event.");
  const s = (h = a.effects) == null ? void 0 : h.changedObjects;
  I0(Array.isArray(s), "Missing deposit effects.");
  const r = /* @__PURE__ */ new Set([(y = a.effects.gasObject) == null ? void 0 : y.objectId, ...(a.transaction.gasData.payment ?? []).map((v) => v.objectId)]), i = /* @__PURE__ */ new Set();
  for (const v of s)
    v.inputState === "Exists" ? v.objectId === t0.nft ? (I0(v.outputState === "DoesNotExist" && v.idOperation === "None" && v.outputOwner === null && ((w = v.inputOwner) == null ? void 0 : w.AddressOwner) === t0.sender && String(v.inputVersion) === String(ce.nft.version) && v.inputDigest === ce.nft.digest, "NFT must be wrapped intact, not deleted or transferred."), i.add(t0.nft)) : v.objectId === t0.vault || v.objectId === t0.vaultAdmin ? (I0(v.outputState === "ObjectWrite" && v.idOperation === "None", "Unexpected vault/admin operation."), v.objectId === t0.vault ? I0(String((C = (I = v.inputOwner) == null ? void 0 : I.Shared) == null ? void 0 : C.initialSharedVersion) === "2" && String((F = (R = v.outputOwner) == null ? void 0 : R.Shared) == null ? void 0 : F.initialSharedVersion) === "2", "Vault must stay shared.") : I0(((j = v.inputOwner) == null ? void 0 : j.AddressOwner) === t0.sender && ((D = v.outputOwner) == null ? void 0 : D.AddressOwner) === t0.sender, "Vault AdminCap must stay in the dev wallet."), i.add(v.objectId)) : I0(r.has(v.objectId) && ((P = v.inputOwner) == null ? void 0 : P.AddressOwner) === t0.sender && (!v.outputOwner || ((O = v.outputOwner) == null ? void 0 : O.AddressOwner) === t0.sender), "Unexpected existing-object mutation.") : I0(v.inputState === "DoesNotExist" && v.outputOwner === null && (v.outputState === "AccumulatorWriteV1" && v.idOperation === "None" || n && v.outputState === "DoesNotExist" && v.idOperation === "Created"), "Unexpected created object or additional effect.");
  I0(i.size === 3, "Missing NFT wrapping, vault or AdminCap effects.");
  const c = (Q = a.effects) == null ? void 0 : Q.gasUsed;
  I0(c, "Missing gas usage.");
  const o = BigInt(c.computationCost) + BigInt(c.storageCost), d = o - BigInt(c.storageRebate);
  return I0(o > 0n && o <= t0.maxGasMist && BigInt(a.transaction.gasData.budget) > 0n && BigInt(a.transaction.gasData.budget) <= t0.maxGasMist, "Gas exceeds the reviewed 0.1-SUI ceiling."), I0((($ = a.balanceChanges) == null ? void 0 : $.length) === 1 && a.balanceChanges[0].address === t0.sender && /^0x0*2::sui::SUI$/.test(a.balanceChanges[0].coinType) && BigInt(a.balanceChanges[0].amount) === -d, "Unexpected asset payment or balance change."), { gasMist: String(d), grossGasMist: String(o), vaultId: t0.vault, nftId: t0.nft };
}
function U3(e) {
  var c, o, d;
  const t = e == null ? void 0 : e.Transaction, n = (o = (c = t == null ? void 0 : t.transaction) == null ? void 0 : c.inputs) == null ? void 0 : o.map((u) => {
    var l;
    return (l = u.Object) == null ? void 0 : l.ImmOrOwnedObject;
  }).filter(Boolean);
  I0((n == null ? void 0 : n.length) === 2, "Exactly NFT and matching admin inputs required.");
  const a = structuredClone(ce), s = n.find((u) => u.objectId === t0.vaultAdmin), r = n.find((u) => u.objectId === t0.nft);
  I0(s && r, "Wrong deposit inputs."), Object.assign(a.vaultAdmin, { version: String(s.version), digest: s.digest }), I0(String(r.version) === String(ce.nft.version) && r.digest === ce.nft.digest, "Original NFT reference changed.");
  const i = D3(e, _3(t0.sender, a));
  if (e.commandResults) {
    const u = (d = e.commandResults[0]) == null ? void 0 : d.mutatedReferences;
    I0((u == null ? void 0 : u.length) === 1, "Expected one mutated vault reference."), I0(Qe(x3(u[0].bcs)) === Qe(R3()), "Simulated vault must hold the full unchanged original NFT.");
  }
  return i;
}
vs(["function quote((uint32 dstEid,bytes32 receiver,bytes message,bytes options,bool payInLzToken) params,address sender) view returns ((uint256 nativeFee,uint256 lzTokenFee) fee)"]);
vs(["function redemptionOptions() view returns (bytes)"]);
async function P3(e) {
  var n;
  await s3(e);
  const t = await e.core.getTransaction({ digest: ui.suiPeerBindingDigest, include: { effects: !0, events: !0, transaction: !0, balanceChanges: !0, objectTypes: !0 }, signal: AbortSignal.timeout(3e4) });
  I0(((n = t.Transaction) == null ? void 0 : n.digest) === ui.suiPeerBindingDigest, "Wrong peer receipt."), a3(t);
}
const V3 = "GLXLAmCD3DrbdK55NXmppr7uPEWDdrYYF9JBd3C5XBvE", F3 = {
  checkpoint: {
    sequenceNumber: 346377185,
    timestamp: "2026-11-17T23:48:14.747Z"
  },
  endpoint: {
    address: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
    version: 1089269257,
    digest: "H6f3o8W3vwRQ2piaKwAbMb123qVBPk9SR4UmhoKbzvm6",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 635685314
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::endpoint_v2::EndpointV2"
        },
        json: {
          id: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
          eid: 30378,
          call_cap: {
            id: "0x8de954b904b90f887ff2e81ff3362ca89e883da6529e55723758cd5093234b0d",
            cap_type: {
              "@variant": "Package",
              pos0: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac"
            }
          },
          oapp_registry: {
            oapps: {
              id: "0x720fc2300c05bb7ad68aefec00a9796b4451c4d1df78bc72cd8c98e774220bec",
              size: "142"
            }
          },
          composer_registry: {
            composers: {
              id: "0xb41ca35805177b946bebf5d339712b4e9bb562b068b33851001f9f0b66847814",
              size: "7"
            }
          },
          message_lib_manager: {
            registry: {
              libs: {
                contents: {
                  id: "0x520bbc08883e22efb29f50283e25b4561ffa7c7b9d7774b14fc1c6272e593e03",
                  size: "2"
                }
              },
              lib_to_type: {
                id: "0xb136bb2fc780a76e636c10f10b10ab33754a3573efa5f1285bf2b35eaf73b50d",
                size: "2"
              }
            },
            default_configs: {
              id: "0xa2371851318b3ba333270daf696dedbc7b89a1107ca362643798c1789ce05a01",
              size: "126"
            },
            oapp_configs: {
              id: "0x0e679b0fcc94fb07a5ec9a14712f8e35e0994b892e64a434e898450eb670e920",
              size: "100"
            }
          }
        }
      }
    }
  },
  uln: {
    address: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
    version: 1089269257,
    digest: "AcckrdnV5VRmY8Ejt95EwQCMBFA7GFjwqpa5nmh3HuS9",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 635685319
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0::uln_302::Uln302"
        },
        json: {
          id: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
          call_cap: {
            id: "0xfacd801d08e3a99c907148fa00ec5f17a0a3ac831dbc95bcd75e601006caafa9",
            cap_type: {
              "@variant": "Package",
              pos0: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0"
            }
          },
          send_uln: {
            default_executor_configs: {
              id: "0x346b468d90db8743673c7ed4fdbe1c40f6a587aac6acc730b3a9bb86cf0919f4",
              size: "126"
            },
            default_uln_configs: {
              id: "0x2bd7d044d837b718a7852959c701c04e842e648cf9047b442d55c838846a13e5",
              size: "126"
            },
            oapp_executor_configs: {
              id: "0x357a98886ef14de3d15e538a808b410cfe026f6b1f971bb2398978d56e4dc181",
              size: "54"
            },
            oapp_uln_configs: {
              id: "0xc53b8a5592cdeea1a7421d209ba5c70e6843d2911e5bb86ad9fb744d888eab60",
              size: "214"
            }
          },
          receive_uln: {
            default_uln_configs: {
              id: "0x5ddc28272722231ecef30237bb48715f128d6995b89a46db25cd9adae0140835",
              size: "126"
            },
            oapp_uln_configs: {
              id: "0x0d89da4d00f46c4b1dab465a867e60eacbf646e56f8816ae55cd7b9495c1bb09",
              size: "239"
            },
            verification: "0x950f66ed27ec0a01a52bda147d74165d4cc20165f0cee0ecae6aaacde13d7741"
          }
        }
      }
    }
  },
  oapp: {
    address: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
    version: 1089269258,
    digest: "VdwgrsSrPBCt29tRR2sH7H7ut2YUA4Eb9L43idahLxL",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 1
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::OApp"
        },
        json: {
          id: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
          oapp_cap: {
            id: "0x4c2a287a86396e551314b63a9fae3d52dd3ee421a53dc4f71c9ba4c3163940c1",
            cap_type: {
              "@variant": "Package",
              pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
            }
          },
          admin_cap: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
          peer: {
            peers: {
              id: "0x9c95e9766e547812fadec00b162dbc7e42e02ebad066bea5bd826c4ae236d913",
              size: "1"
            }
          },
          enforced_options: {
            options: {
              id: "0x827e88b47ff80edbd92a5490c9a9e2784faf984d08dae2d21c93d35c5f7a56d1",
              size: "2"
            }
          },
          sending_call: null
        }
      }
    }
  },
  admin: {
    address: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e",
    version: 1089269258,
    digest: "EjN4KdoP3XMuAzPQbEKnjQDuz2tP2K1orgagGtHyjaWb",
    owner: {
      __typename: "AddressOwner",
      address: {
        address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
      }
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xfdc28afc0110cb2edb94e3e57f2b1ce69b5a99c503b06d15e51cfa212de56e24::oapp::AdminCap"
        },
        json: {
          id: "0x539a1889231aafae8392b1f832189fe8e232d79f293184fb8d77857dd407f00e"
        }
      }
    }
  },
  vault: {
    address: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
    version: 1089269259,
    digest: "8JAvKTsZgLK7CmweNEbe5V4CWYEqGNPLWx4yqVXeF9hL",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 2
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Vault<0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT>"
        },
        json: {
          id: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
          version: "1",
          registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
          cap: {
            id: "0xfda64d5d7047727e9b6ada8e8cf591c2acf3e70529f475de81269ff18f126d80",
            cap_type: {
              "@variant": "Package",
              pos0: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4"
            }
          },
          oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
          nft: {
            id: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
            number: "2720",
            name: "Tree NFT #2720",
            description: "A unique tree from the Tree NFT collection. Rarity: Common",
            image_url: "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieozgvnr7qc4ghsq36zwssuhj7xahuznjlmu6g63clnyt37hjsi4m/2720.jpg",
            rarity: "Common"
          },
          backing: {
            bytes: "BG2iqeFb2CK6BJHZeJR8wb+x/TDm+BOl+xC5srHWpro="
          },
          route: {
            bytes: "Rb8ISZeE6p/2WJNxZalEnVCao33kenKK9E6QM4fzyiw="
          },
          peer: {
            bytes: "AAAAAAAAAAAAAAAAkLUpKlB0z91mXHJrQzzAqX4Npqs="
          },
          bound: !0,
          paused: !1,
          phase: 1,
          announced: !1,
          ack_sent: !1,
          request: {
            bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
          },
          recipient: {
            bytes: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
          }
        }
      }
    }
  },
  channel: {
    address: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
    version: 1089269258,
    digest: "46iexvc4YCLGQNtXuiAVedwqGcnmbUzpMKJmUfm5YV2a",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 1058683488
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::messaging_channel::MessagingChannel"
        },
        json: {
          id: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
          oapp: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
          channels: {
            id: "0xdd1e3f1024b36740b6c1ef8cc120e88f7b61127e665e7069ee3005985cad2c0a",
            size: "1"
          },
          is_sending: !1
        }
      }
    }
  },
  registration: {
    address: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
    version: 1089269257,
    digest: "NVoFVPBULujFwR6gJrECtCiTS25JvWbTmd9LKuhMaR9",
    owner: {
      __typename: "ObjectOwner"
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_field::Field<address,0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac::oapp_registry::OAppRegistration>"
        },
        json: {
          id: "0x2b68c14ea35bd0b208560bcbb9b29ac4e3382f9f46280b1ec4536e5fbeb7bea3",
          name: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
          value: {
            messaging_channel: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
            oapp_info: "AAEceUXklt3krTFC6/jVK5WUb07TRDVo3vqbl97DB8D50QDwAQABAaxzByuU8UqHsjeBxwBMd99nmf3uEJ8kJx1GlrxKZRSkBXZhdWx0Cmx6X3JlY2VpdmUDAUW/CEmXhOqf9liTcWWpRJ1QmqN95HpyivROkDOH88osARx5ReSW3eStMULr+NUrlZRvTtNENWje+puX3sMHwPnRACBkICYW91pWFKz6JkQYJYUhKZ62qJLu7qOS/u+JSMfrUwFTMHhmNmM2ZDQzOWVhMGRhMmYzZTliYTc5ZTQ5OTJhN2E0YzExMzIxNWZiZjU0YzQ0MmFjOTAyMGMzMTVmOTUzNzA1Ojpjb2xsZWN0aW9uOjpORlQAAAA=",
            delegate: "0x0000000000000000000000000000000000000000000000000000000000000000"
          }
        }
      }
    }
  },
  libraries: {
    dynamicField: {
      value: {
        json: {
          send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
          receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
          receive_lib_timeout: null
        }
      }
    }
  },
  send: {
    dynamicField: {
      value: {
        json: {
          confirmations: "5",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
            "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  },
  receive: {
    dynamicField: {
      value: {
        json: {
          confirmations: "20",
          required_dvns: [
            "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
            "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
            "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91",
            "0xfa35508c624925c6f341113f8f9397e5f41750b833af87d0c945a6f5682887f0"
          ],
          optional_dvns: [],
          optional_dvn_threshold: 0
        }
      }
    }
  },
  executor: {
    dynamicField: {
      value: {
        json: {
          max_message_size: "10000",
          executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
        }
      }
    }
  },
  appLibraries: {
    dynamicField: {
      value: {
        json: {
          send_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
          receive_lib: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
          receive_lib_timeout: null
        }
      }
    }
  },
  appSend: {
    dynamicField: {
      value: {
        json: {
          use_default_confirmations: !1,
          use_default_required_dvns: !1,
          use_default_optional_dvns: !1,
          uln_config: {
            confirmations: "5",
            required_dvns: [
              "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
              "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
              "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
            ],
            optional_dvns: [],
            optional_dvn_threshold: 0
          }
        }
      }
    }
  },
  appReceive: {
    dynamicField: {
      value: {
        json: {
          use_default_confirmations: !1,
          use_default_required_dvns: !1,
          use_default_optional_dvns: !1,
          uln_config: {
            confirmations: "20",
            required_dvns: [
              "0x0c12321ebe562b8fb8a74e6d29f144ea199a8f31a4cea3a417ce72477f6dfebb",
              "0x52aa129049de845353484868d1be6e2df6878b0ed2213d94d3c827309aeae685",
              "0x92128a5edf4a0f696464de66d00986ef41b37faf705ceb3d9d9a4e5c306fbf91"
            ],
            optional_dvns: [],
            optional_dvn_threshold: 0
          }
        }
      }
    }
  },
  appExecutor: {
    dynamicField: {
      value: {
        json: {
          max_message_size: "10000",
          executor: "0xde7fe1a6648d587fcc991f124f3aa5b6389340610804108094d5c5fbf61d1989"
        }
      }
    }
  },
  registry: {
    address: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
    version: 2,
    digest: "6dLNdxRWrpZdVjyq8YTqYq7bTvWQqnJVqx4qM3DPFD4y",
    owner: {
      __typename: "Shared",
      initialSharedVersion: 1
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::Registry"
        },
        json: {
          id: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92",
          version: "1",
          cap: null,
          oapp: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
          slot: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
          backing: "0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba",
          nft_type: "ZjZjNmQ0MzllYTBkYTJmM2U5YmE3OWU0OTkyYTdhNGMxMTMyMTVmYmY1NGM0NDJhYzkwMjBjMzE1Zjk1MzcwNTo6Y29sbGVjdGlvbjo6TkZU"
        }
      }
    }
  },
  vaultAdmin: {
    address: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
    version: 1089269259,
    digest: "A758B4i9XqbdKhwVN6PSjnparfSibfkavtjVViozekEH",
    owner: {
      __typename: "AddressOwner",
      address: {
        address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
      }
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4::vault::AdminCap"
        },
        json: {
          id: "0xd2e62542fd631731a6155b24aa22aed2b013acdb658c1b427ebabea7c217e322",
          registry: "0x4d531a6dfed56f977a8120b4c628392fc491065248b5c424b9405443b899df92"
        }
      }
    }
  },
  upgrade: {
    address: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
    version: 1,
    digest: "BCKc8Pq2jvGbyqpSgUWdHaXN9LZSqaurHFZwp6tNuzvH",
    owner: {
      __typename: "AddressOwner",
      address: {
        address: "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"
      }
    },
    asMoveObject: {
      contents: {
        type: {
          repr: "0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap"
        },
        json: {
          id: "0xfe3cb23fb8feabf938e7641672557221f6c199c418f23e4f3d78b10128efc7a7",
          package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
          version: "1",
          policy: 0
        }
      }
    }
  },
  nft: null,
  peerEntry: {
    dynamicField: {
      value: {
        json: {
          bytes: "AAAAAAAAAAAAAAAAkLUpKlB0z91mXHJrQzzAqX4Npqs="
        }
      }
    }
  },
  reserveOptions: {
    dynamicField: {
      value: {
        json: "AAMBABEBAAAAAAAAAAAAAAAAAAMNQA=="
      }
    }
  },
  ackOptions: {
    dynamicField: {
      value: {
        json: "AAMBABEBAAAAAAAAAAAAAAAAAAMNQA=="
      }
    }
  },
  channelPath: {
    dynamicField: {
      value: {
        json: {
          outbound_nonce: "0",
          lazy_inbound_nonce: "0",
          inbound_payload_hashes: {
            id: "0x861288a8c14221c0922c3a7acb5c341bfc4a0c94c5c528858e7a2e2b95ae669b",
            size: "0"
          }
        }
      }
    }
  }
}, Ko = {
  digest: V3,
  currentSuiState: F3
}, $3 = 2, L3 = "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4", z3 = null, G3 = {
  budget: null,
  price: null,
  owner: null,
  payment: null
}, W3 = [
  {
    Object: {
      SharedObject: {
        objectId: "0x45bf08499784ea9ff658937165a9449d509aa37de47a728af44e903387f3ca2c",
        initialSharedVersion: "2",
        mutable: !0
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x1c7945e496dde4ad3142ebf8d52b95946f4ed3443568defa9b97dec307c0f9d1",
        initialSharedVersion: "1",
        mutable: !0
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0xd45b6890fa030bcb43347c0c69a9e5a1a288d1ca7b86b428014752b472f6bf91",
        initialSharedVersion: "635685314",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x8ebd7a0b102a5f7a3d4a08d84dd853fecc4ae0093be6eb02cf0d11dce7d4861f",
        initialSharedVersion: "635685319",
        mutable: !1
      }
    }
  },
  {
    Pure: {
      bytes: "QSVZBAAAAAA="
    }
  },
  {
    Pure: {
      bytes: "AQ=="
    }
  },
  {
    Pure: {
      bytes: "AA=="
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x0d376ab0c11fcbdfa480d4a691c9f7b5d00cc2249692e2949d26d32dafbf8aef",
        initialSharedVersion: "1058683488",
        mutable: !0
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x52e0e092bf361557c68bd3b1c370b9c102dc834d874624d910e1656ebc08bedc",
        initialSharedVersion: "635685308",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x5f24ef7da5e93ca930bf3270468bc2268e84cc83e52c129ea3311b0d5df50c8e",
        initialSharedVersion: "635685317",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x05195518fab7b80e60bc7df11cf791d8658c614e7ed401fc768db77e744e70b3",
        initialSharedVersion: "635685318",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x492ac62cfb43eb1e858a877cf7a0cf396bf38bc1420c727c747ecc19cf9f4e5c",
        initialSharedVersion: "635685308",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0xb6c5e08243222eb0bf95e98c66d26c628f7e0752b7272165d9e7867ff69c36a4",
        initialSharedVersion: "641876028",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x7f7ded52a6073633f8d642458b7899b0eaa7cd1ed7fb8098bd61730853afd3f7",
        initialSharedVersion: "635685317",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0xff718d782c8881e9bcdca063c1e7999c77ee22d7cc6b34c84d5f6f4c2654f7da",
        initialSharedVersion: "635685316",
        mutable: !1
      }
    }
  },
  {
    Object: {
      SharedObject: {
        objectId: "0x1ab2f88e12bece2a39addc97cef895e48e0ed97d03eaa9bd2fa943ab4dd7300e",
        initialSharedVersion: "641875710",
        mutable: !1
      }
    }
  },
  {
    Pure: {
      bytes: "SFlT4urfSqAq+VDPjpFPvStnUjOF5zw2EYNBRZ2NRcQ="
    }
  }
], Q3 = [
  {
    SplitCoins: {
      coin: {
        GasCoin: !0
      },
      amounts: [
        {
          Input: 4
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
      module: "vault",
      function: "send",
      typeArguments: [
        "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT"
      ],
      arguments: [
        {
          Input: 0
        },
        {
          Input: 1
        },
        {
          Input: 5
        },
        {
          Input: 6
        },
        {
          NestedResult: [
            0,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac",
      module: "endpoint_v2",
      function: "send",
      typeArguments: [],
      arguments: [
        {
          Input: 2
        },
        {
          Input: 7
        },
        {
          Result: 1
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
      module: "uln_302",
      function: "send",
      typeArguments: [],
      arguments: [
        {
          Input: 3
        },
        {
          NestedResult: [
            2,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x011da80425fb389d1090743a2a33a48c479f4fd218a25db2cdc072b768a47ce5",
      module: "executor_worker",
      function: "assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 9
        },
        {
          NestedResult: [
            3,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x63e8c59b39720d833bffca2f50e51e48ef426ac0c6ab8e92cf6475c42f5bd24e",
      module: "executor_fee_lib",
      function: "get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 10
        },
        {
          NestedResult: [
            4,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xea932d79771b24103a1cda8e87a65068d6116c047f9dccc3e487cf8316625576",
      module: "price_feed",
      function: "estimate_fee_by_eid",
      typeArguments: [],
      arguments: [
        {
          Input: 11
        },
        {
          NestedResult: [
            5,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x63e8c59b39720d833bffca2f50e51e48ef426ac0c6ab8e92cf6475c42f5bd24e",
      module: "executor_fee_lib",
      function: "confirm_get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 10
        },
        {
          NestedResult: [
            4,
            0
          ]
        },
        {
          NestedResult: [
            5,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x011da80425fb389d1090743a2a33a48c479f4fd218a25db2cdc072b768a47ce5",
      module: "executor_worker",
      function: "confirm_assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 9
        },
        {
          NestedResult: [
            3,
            0
          ]
        },
        {
          NestedResult: [
            4,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 12
        },
        {
          NestedResult: [
            3,
            1
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            9,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xea932d79771b24103a1cda8e87a65068d6116c047f9dccc3e487cf8316625576",
      module: "price_feed",
      function: "estimate_fee_by_eid",
      typeArguments: [],
      arguments: [
        {
          Input: 11
        },
        {
          NestedResult: [
            10,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "confirm_get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            9,
            0
          ]
        },
        {
          NestedResult: [
            10,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "confirm_assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 12
        },
        {
          NestedResult: [
            3,
            1
          ]
        },
        {
          NestedResult: [
            9,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 14
        },
        {
          NestedResult: [
            3,
            1
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            14,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xea932d79771b24103a1cda8e87a65068d6116c047f9dccc3e487cf8316625576",
      module: "price_feed",
      function: "estimate_fee_by_eid",
      typeArguments: [],
      arguments: [
        {
          Input: 11
        },
        {
          NestedResult: [
            15,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "confirm_get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            14,
            0
          ]
        },
        {
          NestedResult: [
            15,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "confirm_assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 14
        },
        {
          NestedResult: [
            3,
            1
          ]
        },
        {
          NestedResult: [
            14,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 15
        },
        {
          NestedResult: [
            3,
            1
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            19,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xea932d79771b24103a1cda8e87a65068d6116c047f9dccc3e487cf8316625576",
      module: "price_feed",
      function: "estimate_fee_by_eid",
      typeArguments: [],
      arguments: [
        {
          Input: 11
        },
        {
          NestedResult: [
            20,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xc3213e769e222f573edb14c63bf11b6481f3d3b66f2206f5911be07032390883",
      module: "dvn_fee_lib",
      function: "confirm_get_fee",
      typeArguments: [],
      arguments: [
        {
          Input: 13
        },
        {
          NestedResult: [
            19,
            0
          ]
        },
        {
          NestedResult: [
            20,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x60d4ef2e0e057d19e947406ccec3ac4d0208adc8e1981964ab2552166a30f461",
      module: "dvn",
      function: "confirm_assign_job",
      typeArguments: [],
      arguments: [
        {
          Input: 15
        },
        {
          NestedResult: [
            3,
            1
          ]
        },
        {
          NestedResult: [
            19,
            0
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x3ce7457bed48ad23ee5d611dd3172ae4fbd0a22ea0e846782a7af224d905dbb0",
      module: "uln_302",
      function: "confirm_send",
      typeArguments: [],
      arguments: [
        {
          Input: 3
        },
        {
          Input: 2
        },
        {
          Input: 8
        },
        {
          Input: 7
        },
        {
          Result: 1
        },
        {
          NestedResult: [
            2,
            0
          ]
        },
        {
          NestedResult: [
            3,
            0
          ]
        },
        {
          NestedResult: [
            3,
            1
          ]
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0xac73072b94f14a87b23781c7004c77df6799fdee109f24271d4696bc4a6514a4",
      module: "vault",
      function: "confirm_send",
      typeArguments: [
        "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT"
      ],
      arguments: [
        {
          Input: 0
        },
        {
          Input: 1
        },
        {
          Result: 1
        }
      ]
    }
  },
  {
    MoveCall: {
      package: "0x31beaef889b08b9c3b37d19280fc1f8b75bae5b2de2410fc3120f403e9a36dac",
      module: "endpoint_send",
      function: "destroy",
      typeArguments: [],
      arguments: [
        {
          NestedResult: [
            25,
            0
          ]
        }
      ]
    }
  },
  {
    TransferObjects: {
      objects: [
        {
          NestedResult: [
            26,
            0
          ]
        }
      ],
      address: {
        Input: 16
      }
    }
  },
  {
    MoveCall: {
      package: "0x0000000000000000000000000000000000000000000000000000000000000001",
      module: "option",
      function: "destroy_none",
      typeArguments: [
        "0x0000000000000000000000000000000000000000000000000000000000000002::coin::Coin<0x3de1504cf3fd75762759e353d9d95389618e557d0552697f19b52e4e927c1dee::zro::ZRO>"
      ],
      arguments: [
        {
          NestedResult: [
            26,
            1
          ]
        }
      ]
    }
  }
], J3 = {
  version: $3,
  sender: L3,
  expiration: z3,
  gasData: G3,
  inputs: W3,
  commands: Q3
}, bi = "0x" + "0".repeat(64), fa = An(cc(["uint64", "uint32", "bytes32", "uint32", "bytes32"], [1n, 30378, t0.package, 30102, t0.peer])), Z = Object.freeze({ ...t0, key: "nftree-original-reserve-v1-8e133122", guid: fa, maxFeeMist: 500000000n, maxGasMist: 100000000n, executorPayee: "0xf99b445ae678d3f28fe7acb91e5d7ee8ab538d7e231a837b12c593fb624ad630", dvnPayee: "0x9004e1e4c6dcc42d1b73269db48d510192665677fcad2079a3c7d1e9e971d34e" }), Y3 = de(["0x0201", Z.vault, Z.nft, bi, bi]), Z3 = de([cc(["uint8", "uint64", "uint32", "bytes32", "uint32", "bytes32"], [1, 1n, 30378, Z.package, 30102, Z.peer]), fa, Y3]), X = (e, t) => {
  if (!e) throw Error(t);
}, yt = (e, t, n) => X(Ce(e) === Ce(t), n), e1 = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/, pi = (e) => btoa(String.fromCharCode(...Uint8Array.from(e.slice(2).match(/../g), (t) => parseInt(t, 16)))), Rn = (e) => JSON.parse(JSON.stringify(e, (t, n) => t === "$kind" || t === "type" ? void 0 : ["initialSharedVersion", "version"].includes(t) ? String(n) : n));
function t1(e, t = 0) {
  var a, s, r, i, c;
  X(t === 0 || t === 1, "Unknown announcement stage."), X(((a = ne(e.vault)) == null ? void 0 : a.announced) === (t === 1), "Announcement already sent or not yet reflected. Check its receipt."), X(((c = (i = (r = (s = e.channelPath) == null ? void 0 : s.dynamicField) == null ? void 0 : r.value) == null ? void 0 : i.json) == null ? void 0 : c.outbound_nonce) === String(t), "Unexpected announcement nonce.");
  const n = structuredClone(e);
  return n.vault.asMoveObject.contents.json.announced = !1, n.channelPath.dynamicField.value.json.outbound_nonce = "0", Xo(n, 1), e;
}
async function H3(e, t = 0) {
  const n = await e.query({ query: e3, signal: AbortSignal.timeout(3e4) });
  return X(!n.errors && n.data, "Cannot verify NFT backing and announcement state."), t1(n.data, t);
}
async function q3(e) {
  var a;
  await P3(e);
  const t = Ko.digest, n = await e.core.getTransaction({ digest: t, include: { effects: !0, events: !0, transaction: !0, balanceChanges: !0, objectTypes: !0 }, signal: AbortSignal.timeout(3e4) });
  X(((a = n.Transaction) == null ? void 0 : a.digest) === t, "Wrong original deposit receipt."), U3(n);
}
function X3(e, t, n, a) {
  X((t == null ? void 0 : t.toLowerCase()) === Z.sender, "Select the Sui dev wallet ending 45c4."), t1(n, 0), X(e === "send", "Unknown announcement action.");
  const s = structuredClone(J3);
  {
    const r = BigInt(a);
    X(r > 0n && r <= Z.maxFeeMist, "Message fee exceeds the reviewed 0.5-SUI ceiling."), s.inputs[4] = { Pure: { bytes: A.u64().serialize(r).toBase64() } };
  }
  return ga.from(JSON.stringify(s));
}
function K3(e, t, n) {
  var l, b, p, m, h, y, w, I, C, R, F, j, D, P;
  X((e == null ? void 0 : e.$kind) === "Transaction" && ((b = (l = e.Transaction) == null ? void 0 : l.status) == null ? void 0 : b.success) === !0, "Announcement " + n + " did not succeed.");
  const a = e.Transaction;
  X(((p = a.transaction) == null ? void 0 : p.sender) === Z.sender && ((m = a.transaction.gasData) == null ? void 0 : m.owner) === Z.sender, "Wrong sender or gas owner.");
  for (const O of ["commands", "inputs"]) yt(Rn(a.transaction[O]), Rn(t.getData()[O]), "Exact announcement " + O + " differ.");
  const s = (h = a.effects) == null ? void 0 : h.gasUsed;
  X(s, "Missing gas effects.");
  const r = BigInt(s.computationCost) + BigInt(s.storageCost), i = r - BigInt(s.storageRebate);
  X(r > 0n && r <= Z.maxGasMist && i >= 0n && BigInt(a.transaction.gasData.budget) > 0n && BigInt(a.transaction.gasData.budget) <= Z.maxGasMist, "Gas exceeds the reviewed 0.1-SUI ceiling.");
  const c = (y = a.effects) == null ? void 0 : y.changedObjects;
  X(Array.isArray(c), "Missing object effects.");
  const o = /* @__PURE__ */ new Set([(w = a.effects.gasObject) == null ? void 0 : w.objectId, ...(a.transaction.gasData.payment ?? []).map((O) => O.objectId)]), d = /* @__PURE__ */ new Map([[Z.vault, "2"], [Z.oapp, "1"], [Z.channel, Z.channelVersion]]), u = /* @__PURE__ */ new Set();
  for (const O of c)
    if (O.inputState === "Exists") {
      if (o.has(O.objectId)) {
        X(((I = O.inputOwner) == null ? void 0 : I.AddressOwner) === Z.sender && (!O.outputOwner || O.outputOwner.AddressOwner === Z.sender), "Gas must belong to the dev wallet.");
        continue;
      }
      X(n === "send", "Quote must not mutate custody or security."), u.add(O.objectId), X(O.outputState === "ObjectWrite" && O.idOperation === "None", "Unexpected announcement object operation."), d.has(O.objectId) ? (X(String((R = (C = O.inputOwner) == null ? void 0 : C.Shared) == null ? void 0 : R.initialSharedVersion) === d.get(O.objectId), "Wrong shared object."), yt(Rn(O.inputOwner), Rn(O.outputOwner), "Shared ownership changed.")) : X(O.objectId === Ae.channelPath.id && ((F = O.inputOwner) == null ? void 0 : F.ObjectOwner) === Ae.channelPath.parent && ((j = O.outputOwner) == null ? void 0 : j.ObjectOwner) === Ae.channelPath.parent, "Unexpected existing-object mutation.");
    } else O.outputState === "ObjectWrite" ? X(O.idOperation === "Created" && /^0x0*2::coin::Coin<0x0*2::sui::SUI>$/.test(((D = a.objectTypes) == null ? void 0 : D[O.objectId]) ?? "") && [Z.sender, Z.executorPayee, Z.dvnPayee].includes((P = O.outputOwner) == null ? void 0 : P.AddressOwner), "Unexpected created object, currency or recipient.") : X(O.inputState === "DoesNotExist" && O.outputOwner === null && (O.outputState === "AccumulatorWriteV1" && O.idOperation === "None" || O.outputState === "DoesNotExist" && O.idOperation === "Created"), "Unexpected additional object effect.");
  return yt([...u].sort(), [...d.keys(), Ae.channelPath.id].sort(), "Expected exactly vault, OApp, channel and outbound-path writes."), { t: a, gas: i };
}
function e9(e, t, n) {
  var l, b, p;
  const { t: a, gas: s } = K3(e, t, "send"), r = BigInt(n);
  X(r > 0n && r <= Z.maxFeeMist, "Unsupported message fee."), X(((l = a.events) == null ? void 0 : l.length) === 3, "Exactly executor/DVN fee and packet events required.");
  const [i, c, o] = a.events;
  X(i.eventType === Z.ulnPackage + "::send_uln::ExecutorFeePaidEvent" && c.eventType === Z.ulnPackage + "::send_uln::DVNFeePaidEvent" && i.json.executor === Z.executor, "Wrong fee events or executor."), yt(i.json.guid, { bytes: pi(fa) }, "Wrong executor GUID."), yt(c.json.guid, i.json.guid, "Wrong verifier GUID."), yt(c.json.dvns, Z.dvns, "Wrong required verifier set."), X(((b = c.json.fees) == null ? void 0 : b.length) === 3, "Exactly three required DVNs expected.");
  const d = [i.json.fee, ...c.json.fees];
  X(i.json.fee.recipient === Z.executorPayee && c.json.fees.every((m) => m.recipient === Z.dvnPayee), "Fee recipient changed."), X(d.every((m) => BigInt(m.fee) >= 0n) && d.reduce((m, h) => m + BigInt(h.fee), 0n) === r, "Worker fees do not equal the quoted payment."), yt([o.eventType, o.json], [Z.endpointPackage + "::messaging_channel::PacketSentEvent", { encoded_packet: pi(Z3), options: Ws, send_library: Z.ulnPackage }], "Wrong packet, source identity, recipient, nonce, payload or delivery options.");
  const u = /* @__PURE__ */ new Map([[Z.sender, -r - s]]);
  for (const m of d) u.set(m.recipient, (u.get(m.recipient) ?? 0n) + BigInt(m.fee));
  X(((p = a.balanceChanges) == null ? void 0 : p.length) === u.size, "Unexpected payment balances.");
  for (const m of a.balanceChanges)
    X(/^0x0*2::sui::SUI$/.test(m.coinType) && u.get(m.address) === BigInt(m.amount), "Unexpected payment recipient, currency or amount."), u.delete(m.address);
  return X(!u.size, "Missing payment balance."), { feeMist: String(r), gasMist: String(s), totalMist: String(r + s), guid: fa, vaultId: Z.vault, nftId: Z.nft };
}
function t9(e) {
  const t = JSON.parse(e.getItem(Z.key) || "null");
  return X(!t || e1.test(t.digest), "Stored receipt is invalid. Check Slush activity."), { pending: e.getItem(Z.key + "-pending") === "1", receipt: t };
}
function n9(e, t) {
  const n = JSON.stringify(t);
  e.setItem(Z.key, n), X(e.getItem(Z.key) === n, "Cannot save the announcement receipt. Copy it from Slush."), e.removeItem(Z.key + "-pending");
}
async function a9(e, { storage: t, client: n = Wo(), now: a = Date.now } = {}) {
  var l, b, p, m, h;
  X(e1.test(e), "Enter the Sui announcement digest from Slush.");
  const s = t9(t).receipt;
  X(!s || s.digest === e, "A different announcement is recorded."), await q3(n);
  const r = await n.core.getTransaction({ digest: e, include: { effects: !0, events: !0, transaction: !0, balanceChanges: !0, objectTypes: !0 }, signal: AbortSignal.timeout(3e4) });
  X(((l = r.Transaction) == null ? void 0 : l.digest) === e, "Wrong announcement receipt.");
  const i = (h = (m = (p = (b = r.Transaction.transaction) == null ? void 0 : b.inputs) == null ? void 0 : p[4]) == null ? void 0 : m.Pure) == null ? void 0 : h.bytes;
  X(i, "Missing fee input.");
  const c = BigInt(A.u64().parse(Uint8Array.from(atob(i), (y) => y.charCodeAt(0)))), o = X3("send", Z.sender, Ko.currentSuiState, c), d = e9(r, o, c);
  await H3(n, 1);
  const u = { digest: e, network: "sui:mainnet", sender: Z.sender, status: "chain_verified", ...d, destinationStatus: "not_yet_verified", verifiedAt: new Date(a()).toISOString() };
  return n9(t, u), u;
}
const K = Object.freeze({ ...it, key: "nftree-original-enable-v1-1d3da001", announcement: "97udy89UfnUqZpTynesymkgSLrt3b61o5qZoMTgPUweK" }), s9 = yn({ abi: ua.contracts.TreeSuitePass.abi, functionName: "setPurchasesPaused", args: [!1] }), Qa = Object.freeze({ address: K.pass, topics: Object.freeze([An(We("PurchasePauseChanged(bool)"))]), data: We(0n, { size: 32 }) }), L0 = (e, t) => {
  if (!e) throw Error(t);
}, X0 = (e, t) => typeof e == "string" && typeof t == "string" && e.toLowerCase() === t.toLowerCase(), r9 = /^0x[0-9a-f]{64}$/i;
async function Ct(e, t, n, a = [], s = [], r = "latest") {
  return _0(e, { method: "eth_call", params: [{ to: t, data: yn({ abi: [{ type: "function", name: n, inputs: a, outputs: [], stateMutability: "view" }], functionName: n, args: s }) }, r] });
}
async function n1(e = Wo()) {
  const t = /* @__PURE__ */ new Map(), n = { getItem: (s) => t.get(s) ?? null, setItem: (s, r) => t.set(s, r), removeItem: (s) => t.delete(s) }, a = await a9(K.announcement, { client: e, storage: n });
  return L0(a.status === "chain_verified" && X0(a.vaultId, K.route) && X0(a.nftId, K.nft), "Original backing announcement is not verified."), a;
}
async function i9(e, { paused: t, source: n = n1 } = {}) {
  await ft(e, K), await n();
  const a = await _0(e, { method: "eth_blockNumber" });
  g0(a, "BNB block");
  for (const [i, c] of [[K.adapter, Jo()], [K.pass, Yo()]])
    L0(X0(await _0(e, { method: "eth_getCode", params: [i, a] }), c), "Original contract runtime or immutable bindings changed.");
  for (const [i, c] of Object.entries({ ...Wn.code, [K.currency]: K.currencySha256 }))
    L0(await Qo(await _0(e, { method: "eth_getCode", params: [i, a] })) === c, "Protocol or currency runtime changed.");
  for (const i of Wn.reads) {
    const c = await _0(e, { method: "eth_call", params: [{ to: i.to, data: i.data }, a] });
    L0(X0(c, i.label === "Pass state" ? We(1n, { size: 32 }) : i.after), "LayerZero " + i.label + " differs from the verified Ready route.");
  }
  const s = [["initialBuyer", BigInt(K.from)], ["controller", BigInt(K.from)], ["route", BigInt(K.route)], ["currency", BigInt(K.currency)], ["treasury", BigInt(K.treasury)], ["PRICE", BigInt(K.price)], ["TOKEN_ID", 1n], ["backingNFT", BigInt(K.nft)], ["state", 1n], ["redemption", 0n], ["recipient", 0n]];
  for (const [i, c] of s) L0(g0(await Ct(e, K.pass, i, [], [], a)) === c, "Original pass " + i + " changed.");
  for (const [i, c] of [["suiPeer", BigInt(K.peer)], ["route", BigInt(K.route)], ["backingNFT", BigInt(K.nft)], ["binder", BigInt(K.from)], ["redemptionGas", 30000000n], ["redemptionSent", 0n]])
    L0(g0(await Ct(e, K.adapter, i, [], [], a)) === c, "Original adapter " + i + " changed.");
  L0(g0(await Ct(e, K.currency, "decimals", [], [], a)) === 18n, "BNB USDT decimals changed."), L0(g0(await Ct(e, K.endpoint, "eid", [], [], a)) === 30102n, "Wrong BNB endpoint."), L0(g0(await Ct(e, K.pass, "balanceOf", [{ name: "owner", type: "address" }], [K.from], a)) === 0n, "Pass was already minted.");
  const r = g0(await Ct(e, K.pass, "purchasesPaused", [], [], a));
  return L0(r === 0n || r === 1n, "Invalid pause flag."), t !== void 0 && L0(r === (t ? 1n : 0n), t ? "Purchases already enabled. Check the existing receipt." : "Purchases are still paused."), { paused: r === 1n, block: a };
}
async function c9(e, t, { readState: n = i9 } = {}) {
  var i;
  L0(r9.test(t), "Enter the BNB purchase enablement transaction hash."), await ft(e, K);
  const a = await _0(e, { method: "eth_getTransactionReceipt", params: [t] });
  if (!a) return { status: "pending", hash: t };
  L0(X0(a.transactionHash, t) && X0(a.from, K.from) && X0(a.to, K.pass) && a.contractAddress === null && g0(a.status) === 1n, "Wrong or failed purchase enablement receipt.");
  const s = await _0(e, { method: "eth_getTransactionByHash", params: [t] });
  L0(s && X0(s.hash, t) && X0(s.from, K.from) && X0(s.to, K.pass) && g0(s.chainId) === 56n && g0(s.value) === 0n && X0(s.input, s9), "Transaction differs from the reviewed purchase enablement.");
  const r = a.logs;
  return L0((r == null ? void 0 : r.length) === 1 && X0(r[0].address, Qa.address) && r[0].removed !== !0 && X0(r[0].data, Qa.data) && ((i = r[0].topics) == null ? void 0 : i.length) === 1 && Qa.topics.every((c, o) => X0(c, r[0].topics[o])), "The exact PurchasePauseChanged(false) event is missing or changed."), await n(e, { paused: !1 }), { status: "verified", hash: t, nonce: String(g0(s.nonce)), target: K.pass, pass: K.pass, blockNumber: a.blockNumber };
}
const Qs = (e) => (e && typeof e == "object" && (Object.values(e).forEach(Qs), Object.freeze(e)), e), B = Qs({ ...K, key: "nftree-original-purchase-v1-1d3da001", enablement: "0xbed02845217412a516a77167a9cf1d2edec25965c6d9568d2c096b8ca1c26830" }), Ee = Qs(De.steps), z = (e, t) => {
  if (!e) throw Error(t);
}, T0 = (e, t) => typeof e == "string" && typeof t == "string" && e.toLowerCase() === t.toLowerCase(), ya = (e) => /^0x[0-9a-f]{64}$/i.test(e ?? ""), a1 = (e) => ["reset", "approve", "buy"].includes(e);
z(T0(De.pass, B.pass) && T0(De.from, B.from) && T0(De.currency, B.currency) && T0(De.treasury, B.treasury) && De.price === B.price && De.chainId === B.chainId && T0(De.nft, B.nft) && T0(De.route, B.route), "Purchase plan identity changed.");
const o9 = vs(["function approve(address spender,uint256 amount)", "function buy()"]);
for (const [e, t, n, a] of [["reset", B.currency, "approve", [B.pass, 0n]], ["approve", B.currency, "approve", [B.pass, BigInt(B.price)]], ["buy", B.pass, "buy", []]])
  z(T0(Ee[e].to, t) && T0(Ee[e].data, yn({ abi: o9, functionName: n, args: a })), "Purchase target, spender or amount changed.");
async function pt(e, t, n, a = [], s = [], r = "latest") {
  return _0(e, { method: "eth_call", params: [{ to: t, data: yn({ abi: [{ type: "function", name: n, inputs: a, outputs: [], stateMutability: "view" }], functionName: n, args: s }) }, r] });
}
function d9({ passState: e, allowance: t, passBalance: n, canPlay: a, owner: s }) {
  return e === "2" ? (z(n === "1" && a === "1" && T0(s, B.from) && t === "0", "Active pass ownership, access check or remaining allowance changed."), "complete") : (z(e === "1" && n === "0" && a === "0", "Original reserve is not Ready for this buyer."), t === B.price ? "buy" : t === "0" ? "approve" : "reset");
}
async function s1(e, { source: t = n1 } = {}) {
  await ft(e, B), await t();
  const n = await _0(e, { method: "eth_blockNumber" });
  g0(n, "BNB block");
  const a = g0(await pt(e, B.pass, "state", [], [], n));
  z(a === 1n || a === 2n, "The original pass is not Ready or Active.");
  for (const [h, y] of [[B.adapter, Jo()], [B.pass, Yo()]])
    z(T0(await _0(e, { method: "eth_getCode", params: [h, n] }), y), "Original contract runtime or immutable bindings changed.");
  for (const [h, y] of Object.entries({ ...Wn.code, [B.currency]: B.currencySha256 }))
    z(await Qo(await _0(e, { method: "eth_getCode", params: [h, n] })) === y, "Protocol or currency runtime changed.");
  for (const h of Wn.reads) {
    const y = await _0(e, { method: "eth_call", params: [{ to: h.to, data: h.data }, n] });
    z(T0(y, h.label === "Pass state" ? We(a, { size: 32 }) : h.after), "LayerZero " + h.label + " differs from the verified Ready route.");
  }
  const s = [["initialBuyer", BigInt(B.from)], ["controller", BigInt(B.from)], ["route", BigInt(B.route)], ["currency", BigInt(B.currency)], ["treasury", BigInt(B.treasury)], ["PRICE", BigInt(B.price)], ["TOKEN_ID", 1n], ["backingNFT", BigInt(B.nft)], ["state", a], ["redemption", 0n], ["recipient", 0n]];
  for (const [h, y] of s) z(g0(await pt(e, B.pass, h, [], [], n)) === y, "Original pass " + h + " changed.");
  for (const [h, y] of [["suiPeer", BigInt(B.peer)], ["route", BigInt(B.route)], ["backingNFT", BigInt(B.nft)], ["binder", BigInt(B.from)], ["redemptionGas", 30000000n], ["redemptionSent", 0n]])
    z(g0(await pt(e, B.adapter, h, [], [], n)) === y, "Original adapter " + h + " changed.");
  z(g0(await pt(e, B.currency, "decimals", [], [], n)) === 18n, "BNB USDT decimals changed."), z(g0(await pt(e, B.endpoint, "eid", [], [], n)) === 30102n, "Wrong BNB endpoint.");
  const r = async (h, y, w = [], I = []) => g0(await pt(e, h, y, w, I, n)), i = [{ name: "owner", type: "address" }], c = [B.from], o = String(await r(B.currency, "balanceOf", i, c)), d = String(await r(B.currency, "allowance", [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], [B.from, B.pass])), u = String(await r(B.pass, "balanceOf", i, c)), l = String(await r(B.pass, "canPlay", i, c)), b = await r(B.pass, "purchasesPaused");
  z(b === 0n, "The original purchase is paused.");
  let p;
  if (a === 2n) {
    const h = await pt(e, B.pass, "ownerOf", [{ name: "tokenId", type: "uint256" }], [1n], n);
    z(/^0x0{24}[0-9a-f]{40}$/i.test(h), "Invalid pass owner."), p = "0x" + h.slice(-40);
  }
  const m = { block: n, passState: String(a), tokenBalance: o, allowance: d, passBalance: u, canPlay: l, owner: p };
  return { ...m, action: d9(m) };
}
async function Ts(e) {
  const t = await Promise.all(["latest", "pending"].map(async (n) => g0(await _0(e, { method: "eth_getTransactionCount", params: [B.from, n] }), "wallet nonce")));
  return z(t[0] === t[1], "A BNB wallet transaction is pending. Check its receipt first."), String(t[0]);
}
async function f9(e, { read: t = s1, enable: n = c9, now: a = Date.now } = {}) {
  await ft(e, B);
  const s = await n(e, B.enablement, { readState: async () => ({}) });
  z(s.status === "verified", "The actual enablement receipt is not verified.");
  const r = await t(e);
  if (r.action === "complete") return { ...r, quotedAt: a() };
  z(BigInt(r.tokenBalance) >= BigInt(B.price), "This wallet needs at least 25 USDT on BNB Smart Chain.");
  const i = await Ts(e), c = Ee[r.action], o = { from: B.from, to: c.to, data: c.data, value: "0x0" }, d = await _0(e, { method: "eth_call", params: [o, "latest"] });
  z(r.action === "buy" ? d === "0x" : d === We(1n, { size: 32 }), "Purchase-step simulation did not return the expected success result.");
  const [u, l, b] = await Promise.all([_0(e, { method: "eth_estimateGas", params: [o, "latest"] }), _0(e, { method: "eth_gasPrice" }), _0(e, { method: "eth_getBalance", params: [B.from, "latest"] })].map(async (h) => g0(await h)));
  z(u > 0n && u <= 700000n && l > 0n, "Unexpected purchase gas estimate.");
  const p = (u * 120n + 99n) / 100n, m = p * l;
  return z(m <= 10000000000000000n, "Buffered gas estimate exceeds 0.01 BNB."), z(b >= m, "More BNB is needed for network gas."), await ft(e, B), z(await Ts(e) === i, "Wallet nonce changed. Refresh and review."), { ...r, nonce: i, target: c.to, gas: String(u), gasLimit: We(p), estimatedFeeWei: String(u * l), gasLimitFeeWei: String(m), quotedAt: a() };
}
function mi(e) {
  return e && a1(e.action) && /^(0|[1-9][0-9]*)$/.test(e.nonce) && T0(e.target, Ee[e.action].to) && (!e.hash || ya(e.hash));
}
function an(e) {
  const t = e.getItem(B.key);
  if (t === null) return { receipts: [] };
  const n = JSON.parse(t);
  return z(n && Array.isArray(n.receipts) && n.receipts.every((a) => mi(a) && a.status === "verified" && ya(a.hash)) && (!n.pending || mi(n.pending)), "Stored purchase state needs review. Check wallet activity before another request."), n;
}
async function p9({ provider: e, storage: t, locks: n, reviewed: a, reviewedQuote: s, isCurrent: r, prepare: i = f9, onQuote: c = () => {
}, now: o = Date.now }) {
  return z(n == null ? void 0 : n.request, "Use current Brave for purchase coordination."), n.request(B.key, { ifAvailable: !0 }, async (d) => {
    z(d, "Another tab is handling this purchase."), z(!an(t).pending, "A wallet request is recorded. Recover its receipt first.");
    const u = s();
    z(a() && u && a1(u.action) && o() >= u.quotedAt && o() - u.quotedAt <= B.maxAge, "Simulate and review a fresh purchase step first.");
    const l = await i(e);
    if (z(r() && a(), "Wallet or review changed."), z(!an(t).pending, "Another request was recorded."), ["action", "nonce", "target", "gas", "gasLimitFeeWei"].some((y) => l[y] !== u[y]) || o() - u.quotedAt > B.maxAge)
      throw c(l), Error("Purchase progress, nonce or gas changed. Review the refreshed step.");
    z(o() >= l.quotedAt && o() - l.quotedAt <= B.maxAge, "Fresh checks expired."), await ft(e, B), z(await Ts(e) === l.nonce, "Wallet nonce changed before signing."), z(r() && a(), "Wallet or review changed.");
    const b = an(t), p = { action: l.action, nonce: l.nonce, target: l.target, requestedAt: new Date(o()).toISOString() };
    zn(t, B.key, { ...b, pending: p });
    let m;
    try {
      m = await e.request({ method: "eth_sendTransaction", params: [{ from: B.from, to: p.target, chainId: B.chainId, nonce: We(BigInt(p.nonce)), value: "0x0", data: Ee[p.action].data, gas: l.gasLimit }] });
    } catch (y) {
      throw (y == null ? void 0 : y.code) === 4001 && zn(t, B.key, b), y;
    }
    z(ya(m), "No valid submission hash returned. Check wallet activity before retrying.");
    const h = { ...b, pending: { ...p, hash: m } };
    return zn(t, B.key, h), h;
  });
}
async function u9(e, t, { read: n = s1 } = {}) {
  var o;
  z(ya(t), "Enter a BNB purchase-step transaction hash."), await ft(e, B);
  const a = await _0(e, { method: "eth_getTransactionReceipt", params: [t] });
  if (!a) return { status: "pending", hash: t };
  z(T0(a.transactionHash, t) && g0(a.status) === 1n && T0(a.from, B.from) && a.contractAddress === null, "Wrong or failed purchase receipt.");
  const s = await _0(e, { method: "eth_getTransactionByHash", params: [t] });
  z(s && T0(s.hash, t) && T0(s.from, B.from) && g0(s.chainId) === 56n && g0(s.value) === 0n, "Wrong purchase transaction identity.");
  const r = Object.keys(Ee).find((d) => T0(s.to, Ee[d].to) && T0(s.input, Ee[d].data));
  z(r && T0(a.to, Ee[r].to), "Payment amount, spender or calldata differs from this purchase.");
  const i = Ee[r];
  z(((o = a.logs) == null ? void 0 : o.length) === i.events.length && i.events.every((d, u) => {
    var b;
    const l = a.logs[u];
    return T0(l.address, d.address) && T0(l.data, d.data) && l.removed !== !0 && ((b = l.topics) == null ? void 0 : b.length) === d.topics.length && d.topics.every((p, m) => T0(p, l.topics[m]));
  }), "Exact USDT approval/payment and pass mint events differ.");
  const c = await n(e);
  return z(r === "buy" ? c.action === "complete" : r === "approve" ? ["buy", "complete"].includes(c.action) : ["approve", "buy", "complete"].includes(c.action), "Current pass or allowance does not reflect this receipt."), await ft(e, B), { status: "verified", hash: t, action: r, nonce: String(g0(s.nonce)), target: i.to, blockNumber: a.blockNumber, liveAction: c.action };
}
async function m9({ provider: e, hash: t, storage: n, locks: a, isCurrent: s = () => !0, verify: r = u9 }) {
  return z(a == null ? void 0 : a.request, "Use current Brave for receipt coordination."), a.request(B.key, { ifAvailable: !0 }, async (i) => {
    var d;
    z(i, "Another tab is checking this purchase.");
    const c = an(n);
    (d = c.pending) != null && d.hash && z(T0(c.pending.hash, t), "A different transaction is recorded.");
    const o = await r(e, t);
    return z(s(), "Wallet changed during receipt verification."), z(JSON.stringify(an(n)) === JSON.stringify(c), "Stored purchase state changed during verification."), o.status === "pending" || (c.pending && z(o.action === c.pending.action && o.nonce === c.pending.nonce && T0(o.target, c.pending.target), "Receipt does not match the recorded request."), zn(n, B.key, { receipts: [...c.receipts.filter((u) => !T0(u.hash, t)), o] })), o;
  });
}
export {
  B as C,
  Ee as STEPS,
  b9 as createReadProvider,
  an as loadState,
  f9 as preflight,
  s1 as readPurchase,
  m9 as recoverReceipt,
  p9 as requestPurchase,
  d9 as resolveAction,
  u9 as verifyReceipt
};
