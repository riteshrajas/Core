"use client";

import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { aalToReactFlow } from '../lib/aal-graph-logic';

interface AALGraphProps {
  ir: {
    nodes: any[];
    edges: any[];
  };
}

export const AALGraph: React.FC<AALGraphProps> = ({ ir }) => {
  const { nodes, edges } = useMemo(() => aalToReactFlow(ir), [ir]);

  return (
    <div style={{ width: '100%', height: '500px', background: '#111', borderRadius: '12px', overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
      >
        <Background color="#333" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
};
