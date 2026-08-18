const registry = Object.create(null);

export const actions = new Proxy(registry, {
  get(target, property) {
    if (property in target) return target[property];
    return (...args) => {
      throw new Error(`Application action "${String(property)}" was called before registration (${args.length} argument(s)).`);
    };
  },
});

export function registerActions(owner, methods) {
  for (const [name, method] of Object.entries(methods)) {
    if (typeof method !== 'function') throw new TypeError(`${owner}.${name} must be a function.`);
    if (registry[name]) throw new Error(`Application action "${name}" is already registered.`);
    registry[name] = method;
  }
}
