// Eye-height routes through the gallery's open floor. Obstacles include a
// visitor-sized clearance, so a click across a plinth walks around its edges.
export function createNavigator({ bounds, obstacles, clearance = .34, step = .25 }) {
  const area = { minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z };
  const blocks = obstacles.map(b => ({ minX: b.minX - clearance, maxX: b.maxX + clearance, minZ: b.minZ - clearance, maxZ: b.maxZ + clearance }));
  const clamp = p => ({ x: Math.max(area.minX, Math.min(area.maxX, p.x)), z: Math.max(area.minZ, Math.min(area.maxZ, p.z)) });
  const free = p => p.x >= area.minX && p.x <= area.maxX && p.z >= area.minZ && p.z <= area.maxZ && !blocks.some(b => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ);
  const clear = (a, b) => {
    if (!free(a) || !free(b)) return false;
    // Intersect the entire segment with each clearance rectangle. Sampling can
    // skip short intersections at diagonal corners and let a route cut inward.
    return !blocks.some(block => {
      let enter = 0, leave = 1;
      for (const [axis, min, max] of [['x', block.minX, block.maxX], ['z', block.minZ, block.maxZ]]) {
        const delta = b[axis] - a[axis];
        if (Math.abs(delta) < 1e-12) {
          if (a[axis] < min || a[axis] > max) return false;
        } else {
          let first = (min - a[axis]) / delta, last = (max - a[axis]) / delta;
          if (first > last) [first, last] = [last, first];
          enter = Math.max(enter, first); leave = Math.min(leave, last);
          if (enter > leave) return false;
        }
      }
      return true;
    });
  };
  const columns = Math.ceil((area.maxX - area.minX) / step) + 1, rows = Math.ceil((area.maxZ - area.minZ) / step) + 1;
  const nodes = Array.from({ length: columns * rows }, (_, i) => ({ x: area.minX + i % columns * step, z: area.minZ + Math.floor(i / columns) * step }));
  const available = nodes.map(free);
  function nearest(p) {
    let best = -1, distance = Infinity;
    const needsConnection = free(p);
    nodes.forEach((n, i) => {
      if (!available[i]) return;
      const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2;
      // A nearby node can lie across a corner. Free endpoints must connect to
      // their grid node without crossing an obstacle before A* starts/ends.
      if (d < distance && (!needsConnection || clear(p, n))) { best = i; distance = d; }
    });
    return best;
  }
  function route(origin, destination) {
    const start = clamp(origin), target = clamp(destination);
    const startIndex = nearest(start), targetIndex = nearest(target);
    if (startIndex < 0 || targetIndex < 0) return [];
    const from = free(start) ? start : nodes[startIndex], to = free(target) ? target : nodes[targetIndex];
    if (clear(from, to)) return [from, to];
    const costs = new Float64Array(nodes.length).fill(Infinity), previous = new Int32Array(nodes.length).fill(-1), closed = new Uint8Array(nodes.length);
    const open = [startIndex]; costs[startIndex] = 0;
    const estimate = i => Math.hypot(nodes[i].x - to.x, nodes[i].z - to.z);
    while (open.length) {
      let best = 0;
      for (let j = 1; j < open.length; j++) if (costs[open[j]] + estimate(open[j]) < costs[open[best]] + estimate(open[best])) best = j;
      const current = open.splice(best, 1)[0];
      if (current === targetIndex) break;
      if (closed[current]) continue; closed[current] = 1;
      const col = current % columns, row = Math.floor(current / columns);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const x = col + dx, z = row + dz;
        if (x < 0 || x >= columns || z < 0 || z >= rows) continue;
        const next = z * columns + x;
        if (!available[next] || closed[next] || !clear(nodes[current], nodes[next])) continue;
        const cost = costs[current] + step * Math.hypot(dx, dz);
        if (cost < costs[next]) { costs[next] = cost; previous[next] = current; open.push(next); }
      }
    }
    if (targetIndex !== startIndex && previous[targetIndex] === -1) return [];
    const path = [to];
    for (let i = targetIndex; i !== -1; i = previous[i]) { path.push(nodes[i]); if (i === startIndex) break; }
    path.push(from); path.reverse();
    const smooth = [from]; let anchor = 0;
    while (anchor < path.length - 1) {
      let next = path.length - 1;
      while (next > anchor + 1 && !clear(path[anchor], path[next])) next--;
      smooth.push(path[next]); anchor = next;
    }
    return smooth;
  }
  function move(origin, offset) {
    const from = { x: origin.x, z: origin.z }, to = { x: from.x + offset.x, z: from.z + offset.z };
    if (clear(from, to)) return to;
    // Slide along a blocked edge while respecting the same clearance as clicks.
    let next = from;
    const across = { x: to.x, z: next.z };
    if (clear(next, across)) next = across;
    const along = { x: next.x, z: to.z };
    if (clear(next, along)) next = along;
    return next;
  }
  return { route, free, clear, move };
}
