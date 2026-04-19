export function aalToReactFlow(ir: any) {
  const nodes = ir.nodes.map((node: any, index: number) => ({
    id: node.id,
    type: node.type === "agent" ? "default" : "input",
    data: { label: node.id },
    position: { x: index * 200, y: index * 100 }, // Basic auto-layout
    style: {
      background: node.type === "agent" ? "#3b82f6" : "#10b981", // Blue for agent, Green for iot
      color: "#fff",
      borderRadius: "8px",
      padding: "10px",
    }
  }));

  const edges = ir.edges.map((edge: any) => ({
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    label: edge.trigger || "",
    animated: edge.type === "delegation",
    style: {
      strokeDasharray: edge.type === "delegation" ? "5 5" : "0",
    }
  }));

  return { nodes, edges };
}
