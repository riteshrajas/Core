import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore
import { aalToReactFlow } from "./aal-graph-logic.js";

test("aalToReactFlow maps nodes correctly", () => {
  const ir = {
    nodes: [{ id: "A1", type: "agent" }],
    edges: []
  };
  const result = aalToReactFlow(ir);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].id, "A1");
  assert.equal(result.nodes[0].data.label, "A1");
});

test("aalToReactFlow maps edges correctly", () => {
  const ir = {
    nodes: [{ id: "A1", type: "agent" }, { id: "S1", type: "iot" }],
    edges: [{ source: "A1", target: "S1", type: "connection", trigger: "t1" }]
  };
  const result = aalToReactFlow(ir);
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].source, "A1");
  assert.equal(result.edges[0].label, "t1");
});
