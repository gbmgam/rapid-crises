/**
 * A* Pathfinding Utility for Tactical Mesh
 */

export interface Node {
  id: string;
  x: number;
  y: number;
}

export interface Edge {
  from: string;
  to: string;
  weight: number;
}

export function findPath(
  startNodeId: string,
  targetNodeIds: string | string[],
  nodes: Node[],
  edges: Edge[],
  blockedNodeIds: Set<string>
): Node[] | null {
  const targetIds = Array.isArray(targetNodeIds) ? targetNodeIds : [targetNodeIds];
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const openSet = new Set<string>([startNodeId]);

  nodes.forEach(node => {
    gScore.set(node.id, Infinity);
    fScore.set(node.id, Infinity);
  });

  const getHeuristic = (a: string) => {
    const na = nodes.find(n => n.id === a)!;
    const targetNodes = nodes.filter(n => targetIds.includes(n.id));
    if (targetNodes.length === 0) return Infinity;
    
    // Nearest target heuristic
    return Math.min(...targetNodes.map(nb => 
      Math.sqrt((na.x - nb.x) ** 2 + (na.y - nb.y) ** 2)
    ));
  };

  gScore.set(startNodeId, 0);
  fScore.set(startNodeId, getHeuristic(startNodeId));

  while (openSet.size > 0) {
    let currentId = Array.from(openSet).reduce((a, b) => 
      fScore.get(a)! < fScore.get(b)! ? a : b
    );

    if (targetIds.includes(currentId)) {
      const path: Node[] = [];
      let tempId: string | undefined = currentId;
      while (tempId) {
        path.unshift(nodes.find(n => n.id === tempId)!);
        tempId = cameFrom.get(tempId);
      }
      return path;
    }

    openSet.delete(currentId);

    const neighbors = edges
      .filter(e => e.from === currentId || e.to === currentId)
      .map(e => (e.from === currentId ? e.to : e.from))
      .filter(id => !blockedNodeIds.has(id));

    neighbors.forEach(neighborId => {
      const edge = edges.find(e => 
        (e.from === currentId && e.to === neighborId) || 
        (e.from === neighborId && e.to === currentId)
      )!;
      
      const tentativeGScore = gScore.get(currentId)! + edge.weight;

      if (tentativeGScore < gScore.get(neighborId)!) {
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeGScore);
        fScore.set(neighborId, tentativeGScore + getHeuristic(neighborId));
        openSet.add(neighborId);
      }
    });
  }

  return null;
}
