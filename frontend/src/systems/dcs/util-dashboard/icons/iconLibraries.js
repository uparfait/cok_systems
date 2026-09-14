import React from "react";

/**
 * Every icon library a KPI card may draw from, behind ONE contract: a
 * library loads on demand (each is its own lazily fetched bundle) into
 * { names, render(name, props) }. An icon is referenced as
 * "<library id>:<icon name>"; a bare Tabler component name predates the
 * prefix and still resolves to Tabler.
 */

const DEFAULT_LIBRARY = "tabler";
const cache = new Map();

function is_component(value) {
  return typeof value === "function" || (value !== null && typeof value === "object" && value.$$typeof !== undefined);
}

// Names React itself exports - a few CommonJS icon packages re-export React
// wholesale next to their icons, and those must never be listed as icons.
const REACT_EXPORTS = new Set(Object.keys(React).concat(["default", "module.exports", "__esModule"]));

function component_names(module, accept) {
  return Object.keys(module)
    .filter((key) => !REACT_EXPORTS.has(key) && is_component(module[key]) && (!accept || accept(key)))
    .sort();
}

/** CommonJS packages arrive with their icons under `default`; ESM ones do not. */
function unwrap(module) {
  const named = Object.keys(module).filter((key) => !REACT_EXPORTS.has(key));
  return named.length === 0 && module.default && typeof module.default === "object" ? module.default : module;
}

/** A library whose module exports one React component per icon. */
function component_library(load_module, accept, props_for) {
  return async () => {
    const module = unwrap(await load_module());
    const names = component_names(module, accept);
    return {
      names,
      render: (name, props) => (module[name] ? React.createElement(module[name], props_for(props)) : null),
    };
  };
}

const size_color = ({ size, color }) => ({ size, color });
const box_color = ({ size, color }) => ({ style: { width: size, height: size, color } });

// react-icons names carry their set's prefix ("GiCat"); `prefix` strips it
// from the readable label only - the stored name keeps it.
function react_icons_set(id, label, load_module, prefix) {
  return { id, label, prefix, load: component_library(load_module, null, size_color) };
}

function fontawesome_pack(id, label, load_icons) {
  return {
    id,
    label,
    load: async () => {
      const [{ FontAwesomeIcon }, pack] = await Promise.all([import("@fortawesome/react-fontawesome"), load_icons()]);
      const names = Object.keys(pack)
        .filter((key) => /^fa[A-Z0-9]/.test(key) && pack[key] && pack[key].iconName)
        .sort();
      return {
        names,
        render: (name, { size, color }) =>
          pack[name] ? React.createElement(FontAwesomeIcon, { icon: pack[name], style: { width: size, height: size, color } }) : null,
      };
    },
  };
}

export const ICON_LIBRARIES = [
  {
    id: "tabler",
    label: "Tabler Icons",
    load: component_library(
      () => import("@tabler/icons-react"),
      (key) => /^Icon[A-Za-z0-9]+$/.test(key),
      ({ size, color }) => ({ size, color, stroke: 1.8 }),
    ),
  },
  {
    id: "lucide",
    label: "Lucide",
    load: async () => {
      const module = await import("lucide-react");
      const icons = module.icons || {};
      const names = Object.keys(icons).sort();
      return {
        names,
        render: (name, { size, color }) => (icons[name] ? React.createElement(icons[name], { size, color, strokeWidth: 1.8 }) : null),
      };
    },
  },
  {
    id: "phosphor",
    label: "Phosphor",
    load: async () => {
      const module = await import("@phosphor-icons/react");
      const all = component_names(module, (key) => !["IconContext", "IconBase", "SSR"].includes(key));
      const set = new Set(all);
      // v2 exports every icon twice ("Cat" and "CatIcon"); keep one.
      const names = all.filter((key) => !(key.endsWith("Icon") && set.has(key.slice(0, -4))));
      return {
        names,
        render: (name, { size, color }) => (module[name] ? React.createElement(module[name], { size, color, weight: "regular" }) : null),
      };
    },
  },
  { id: "heroicons-outline", label: "Heroicons Outline", load: component_library(() => import("@heroicons/react/24/outline"), null, box_color) },
  { id: "heroicons-solid", label: "Heroicons Solid", load: component_library(() => import("@heroicons/react/24/solid"), null, box_color) },
  fontawesome_pack("fa-solid", "Font Awesome Solid", () => import("@fortawesome/free-solid-svg-icons")),
  fontawesome_pack("fa-regular", "Font Awesome Regular", () => import("@fortawesome/free-regular-svg-icons")),
  fontawesome_pack("fa-brands", "Font Awesome Brands", () => import("@fortawesome/free-brands-svg-icons")),
  {
    id: "mui",
    label: "Material UI Icons",
    load: component_library(() => import("@mui/icons-material"), null, ({ size, color }) => ({ style: { fontSize: size, color } })),
  },
  {
    id: "hugeicons",
    label: "Hugeicons",
    load: async () => {
      const [{ HugeiconsIcon }, core] = await Promise.all([import("@hugeicons/react"), import("@hugeicons/core-free-icons")]);
      const names = Object.keys(core)
        .filter((key) => key.endsWith("Icon") && Array.isArray(core[key]))
        .sort();
      return {
        names,
        render: (name, { size, color }) => (core[name] ? React.createElement(HugeiconsIcon, { icon: core[name], size, color, strokeWidth: 1.6 }) : null),
      };
    },
  },
  { id: "bootstrap", label: "Bootstrap Icons", load: component_library(() => import("react-bootstrap-icons"), (key) => key !== "default", size_color) },
  {
    id: "iconoir",
    label: "Iconoir",
    load: component_library(
      () => import("iconoir-react"),
      (key) => !["IconoirProvider", "IconoirContext"].includes(key),
      ({ size, color }) => ({ width: size, height: size, color, strokeWidth: 1.6 }),
    ),
  },
  { id: "unicons", label: "Unicons", load: component_library(() => import("@iconscout/react-unicons"), (key) => /^Uil/.test(key), size_color) },
  {
    id: "feather",
    label: "Feather Icons",
    load: component_library(() => import("feather-icons-react"), null, ({ size, color }) => ({ size, style: { color } })),
  },
  {
    id: "eva",
    label: "Eva Icons",
    load: async () => {
      const module = await import("eva-icons");
      const eva = module.default && module.default.icons ? module.default : module;
      const icons = eva.icons || {};
      const names = Object.keys(icons).sort();
      return {
        names,
        render: (name, { size, color }) =>
          icons[name]
            ? React.createElement("span", {
                style: { display: "inline-flex", width: size, height: size, color },
                dangerouslySetInnerHTML: { __html: icons[name].toSvg({ width: size, height: size, fill: color || "currentColor" }) },
              })
            : null,
      };
    },
  },
  react_icons_set("ri-remix", "Remix Icon", () => import("react-icons/ri"), /^Ri/),
  react_icons_set("ri-game", "Game Icons", () => import("react-icons/gi"), /^Gi/),
  react_icons_set("ri-ant", "Ant Design", () => import("react-icons/ai"), /^Ai/),
  react_icons_set("ri-box", "BoxIcons", () => import("react-icons/bi"), /^Bi/),
  // react-icons/md and react-icons/io5 are deliberately absent: other pages
  // import them statically, so listing their whole sets here would drag
  // every one of their icons into the main bundle (Material is covered by
  // the Material UI library above).
  react_icons_set("ri-cssgg", "css.gg", () => import("react-icons/cg"), /^Cg/),
  react_icons_set("ri-typicons", "Typicons", () => import("react-icons/ti"), /^Ti/),
  react_icons_set("ri-vscode", "VS Code Icons", () => import("react-icons/vsc"), /^Vsc/),
  react_icons_set("ri-simple", "Simple Icons", () => import("react-icons/si"), /^Si/),
  react_icons_set("ri-weather", "Weather Icons", () => import("react-icons/wi"), /^Wi/),
  react_icons_set("ri-lineawesome", "Line Awesome", () => import("react-icons/lia"), /^Lia/),
  react_icons_set("ri-flatcolor", "Flat Color Icons", () => import("react-icons/fc"), /^Fc/),
  react_icons_set("ri-octicons", "Octicons", () => import("react-icons/go"), /^Go/),
  react_icons_set("ri-radix", "Radix Icons", () => import("react-icons/rx"), /^Rx/),
  react_icons_set("ri-grommet", "Grommet Icons", () => import("react-icons/gr"), /^Gr/),
  react_icons_set("ri-circum", "Circum Icons", () => import("react-icons/ci"), /^Ci/),
  react_icons_set("ri-themify", "Themify", () => import("react-icons/tfi"), /^Tfi/),
  react_icons_set("ri-icomoon", "IcoMoon Free", () => import("react-icons/im"), /^Im/),
  react_icons_set("ri-devicons", "Devicons", () => import("react-icons/di"), /^Di/),
  react_icons_set("ri-simpleline", "Simple Line Icons", () => import("react-icons/sl"), /^Sl/),
];

export const library_definition = (id) => ICON_LIBRARIES.find((library) => library.id === id) || null;

/** Loads (once) one library into its { names, render } contract. */
export function load_library(id) {
  const definition = library_definition(id);
  if (!definition) return Promise.resolve(null);
  if (!cache.has(id)) {
    cache.set(
      id,
      definition.load().catch((error) => {
        cache.delete(id);
        throw error;
      }),
    );
  }
  return cache.get(id);
}

export const ICON_ID_PATTERN = /^(?:[a-z0-9_-]{1,40}:)?[A-Za-z0-9_-]{1,100}$/;

/** "lucide:Cat" -> { library: "lucide", name: "Cat" }; a bare name is Tabler. */
export function parse_icon_id(icon_id) {
  if (typeof icon_id !== "string" || !ICON_ID_PATTERN.test(icon_id)) return null;
  const at = icon_id.indexOf(":");
  if (at === -1) return { library: DEFAULT_LIBRARY, name: icon_id };
  return { library: icon_id.slice(0, at), name: icon_id.slice(at + 1) };
}

export const make_icon_id = (library, name) => `${library}:${name}`;

/** "IconChartBar" / "faChartBar" / "GiCat" read as "Chart Bar" / "Chart Bar" / "Cat". */
export function icon_label(name, library_id) {
  const definition = library_id ? library_definition(library_id) : null;
  const bare = definition && definition.prefix ? String(name || "").replace(definition.prefix, "") : String(name || "");
  return bare
    .replace(/^(Icon|Uil|fa)(?=[A-Z0-9])/, "")
    .replace(/Icon$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .trim();
}

export function search_key(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
