import React, { useCallback, useState, useEffect } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    useReactFlow,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TriggerNode, ConditionNode, ActionNode } from './CustomNodes';
import {
    AlertTriangle, Play, Settings, Battery, Map, MapPin, Users,
    MousePointer2, Trash2, Zap, Anchor, Radio, Shield, ArrowDownCircle
} from 'lucide-react';

const nodeTypes = {
    trigger: TriggerNode,
    condition: ConditionNode,
    action: ActionNode,
};

const initialNodes = [
    { id: '1', type: 'trigger', position: { x: 400, y: 50 }, data: { label: 'Battery < 20%', subLabel: 'Critical Power Level' } },
    { id: '2', type: 'condition', position: { x: 400, y: 200 }, data: { label: 'Location', subLabel: 'Terrain Analysis' } },
    { id: '3', type: 'action', position: { x: 150, y: 400 }, data: { label: 'Hover', actionType: 'hover' } },
    { id: '4', type: 'action', position: { x: 350, y: 400 }, data: { label: 'Distress Signal', actionType: 'signal' } },
    { id: '5', type: 'condition', position: { x: 650, y: 400 }, data: { label: 'Population Density', subLabel: 'Safety Check' } },
    { id: '6', type: 'action', position: { x: 550, y: 600 }, data: { label: 'Navigate Safe Zone', actionType: 'navigate' } },
    { id: '7', type: 'action', position: { x: 800, y: 600 }, data: { label: 'Soft Landing', actionType: 'land' } },
];

const initialEdges = [
    { id: 'e1-2', source: '1', target: '2', animated: false },
    { id: 'e2-3', source: '2', sourceHandle: 'true', target: '3', label: 'Over Water', animated: false },
    { id: 'e2-4', source: '2', sourceHandle: 'true', target: '4', label: 'Over Water', animated: false },
    { id: 'e2-5', source: '2', sourceHandle: 'false', target: '5', label: 'Over Land', animated: false },
    { id: 'e5-6', source: '5', sourceHandle: 'true', target: '6', label: 'High', animated: false },
    { id: 'e5-7', source: '5', sourceHandle: 'false', target: '7', label: 'Low', animated: false },
];

function LogicBuilderContent() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [conflict, setConflict] = useState(null);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [mode, setMode] = useState('edit'); // 'edit' | 'simulate'

    // Simulation State
    const [simState, setSimState] = useState({
        battery: 15,
        location: 'water', // 'water' | 'land'
        density: 'low',    // 'high' | 'low'
    });

    const { screenToFlowPosition } = useReactFlow();

    // Handle Selection
    const onNodeClick = useCallback((_, node) => {
        setSelectedNodeId(node.id);
        setMode('edit');
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    // Conflict Detection
    useEffect(() => {
        const checkConflicts = () => {
            const actionNodes = nodes.filter(n => n.type === 'action');
            const hoverNodes = actionNodes.filter(n => n.data.actionType === 'hover');
            const landNodes = actionNodes.filter(n => n.data.actionType === 'land');
            const navigateNodes = actionNodes.filter(n => n.data.actionType === 'navigate');

            const hoverIds = hoverNodes.map(n => n.id);
            const landIds = landNodes.map(n => n.id);
            const navigateIds = navigateNodes.map(n => n.id);

            const sourcesWithHover = edges.filter(e => hoverIds.includes(e.target)).map(e => e.source + e.sourceHandle);
            const sourcesWithLand = edges.filter(e => landIds.includes(e.target)).map(e => e.source + e.sourceHandle);
            const sourcesWithNavigate = edges.filter(e => navigateIds.includes(e.target)).map(e => e.source + e.sourceHandle);

            const conflictHoverLand = sourcesWithHover.some(s => sourcesWithLand.includes(s));
            const conflictLandNavigate = sourcesWithLand.some(s => sourcesWithNavigate.includes(s));

            let conflictingIds = [];
            let conflictMsg = null;

            if (conflictHoverLand) {
                conflictMsg = "Conflicting Actions: Cannot 'Hover' and 'Land' simultaneously.";
                conflictingIds = [...hoverIds, ...landIds];
            } else if (conflictLandNavigate) {
                conflictMsg = "Conflicting Actions: Cannot 'Soft Landing' and 'Navigate' simultaneously.";
                conflictingIds = [...landIds, ...navigateIds];
            }

            setConflict(conflictMsg);

            // Update nodes with conflict state
            // We only update if the state actually changes to avoid infinite loops
            const hasChanged = nodes.some(n => {
                const shouldHaveConflict = conflictingIds.includes(n.id);
                return !!n.data.hasConflict !== shouldHaveConflict;
            });

            if (hasChanged) {
                setNodes(nds => nds.map(n => ({
                    ...n,
                    data: { ...n.data, hasConflict: conflictingIds.includes(n.id) }
                })));
            }
        };

        checkConflicts();
    }, [nodes, edges, setNodes]);

    // Simulation Logic
    useEffect(() => {
        if (mode !== 'simulate') {
            // Reset visuals when not simulating
            setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isActive: false, activeBranch: null } })));
            setEdges(eds => eds.map(e => ({ ...e, animated: false, style: { stroke: '#333' } })));
            return;
        }

        // 1. Evaluate Triggers
        const activeNodeIds = new Set();
        const activeEdgeIds = new Set();
        const activeBranches = {}; // nodeId -> 'true' | 'false'

        // Helper to recursively traverse
        const traverse = (nodeId) => {
            if (activeNodeIds.has(nodeId)) return; // Prevent cycles
            activeNodeIds.add(nodeId);

            const node = nodes.find(n => n.id === nodeId);
            if (!node) return;

            let nextNodes = [];

            if (node.type === 'trigger') {
                // Check battery
                if (node.data.label.includes('Battery') && simState.battery < 20) {
                    // Trigger is active, find all outgoing edges
                    const outEdges = edges.filter(e => e.source === nodeId);
                    outEdges.forEach(e => activeEdgeIds.add(e.id));
                    nextNodes = outEdges.map(e => e.target);
                }
            } else if (node.type === 'condition') {
                // Evaluate condition
                let result = false;
                if (node.data.label.includes('Location')) {
                    result = simState.location === 'water'; // True = Water
                } else if (node.data.label.includes('Population')) {
                    result = simState.density === 'high'; // True = High
                }

                const branch = result ? 'true' : 'false';
                activeBranches[nodeId] = branch;

                // Find edges matching the branch
                const outEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === branch);
                outEdges.forEach(e => activeEdgeIds.add(e.id));
                nextNodes = outEdges.map(e => e.target);
            } else if (node.type === 'action') {
                // End of line
            }

            nextNodes.forEach(traverse);
        };

        // Start traversal from triggers
        nodes.filter(n => n.type === 'trigger').forEach(n => traverse(n.id));

        // Update Visuals
        setNodes(nds => nds.map(n => ({
            ...n,
            data: {
                ...n.data,
                isActive: activeNodeIds.has(n.id),
                activeBranch: activeBranches[n.id]
            }
        })));

        setEdges(eds => eds.map(e => ({
            ...e,
            animated: activeEdgeIds.has(e.id),
            style: {
                stroke: activeEdgeIds.has(e.id) ? '#00e5ff' : '#333',
                strokeWidth: activeEdgeIds.has(e.id) ? 2 : 1
            }
        })));

    }, [mode, simState, nodes.length, edges.length, JSON.stringify(nodes.map(n => n.data.label))]);

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
    const onDragOver = useCallback((event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow');
            const label = event.dataTransfer.getData('application/label');
            const subLabel = event.dataTransfer.getData('application/subLabel');
            const actionType = event.dataTransfer.getData('application/actionType');

            if (!type) return;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = {
                id: `${type}-${nodes.length + 1}`,
                type,
                position,
                data: { label, subLabel, actionType },
            };
            setNodes((nds) => nds.concat(newNode));
        },
        [nodes, setNodes, screenToFlowPosition],
    );

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    const updateNodeData = (key, value) => {
        setNodes(nds => nds.map(n => {
            if (n.id === selectedNodeId) {
                return { ...n, data: { ...n.data, [key]: value } };
            }
            return n;
        }));
    };

    const deleteNode = () => {
        setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
        setSelectedNodeId(null);
    };

    return (
        <div className="w-full h-screen flex bg-bg text-text-main overflow-hidden">
            <Sidebar />

            <div className="flex-1 h-full relative flex flex-col">
                {/* Toolbar */}
                <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-4 z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex bg-bg rounded p-1 border border-border">
                            <button
                                onClick={() => setMode('edit')}
                                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-colors ${mode === 'edit' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text-main'}`}
                            >
                                <MousePointer2 size={14} /> Edit
                            </button>
                            <button
                                onClick={() => setMode('simulate')}
                                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-colors ${mode === 'simulate' ? 'bg-success/20 text-success' : 'text-text-muted hover:text-text-main'}`}
                            >
                                <Play size={14} /> Simulate
                            </button>
                        </div>
                    </div>

                    {conflict && (
                        <div className="flex items-center gap-2 text-danger bg-danger/10 px-3 py-1.5 rounded border border-danger/20 animate-pulse">
                            <AlertTriangle size={16} />
                            <span className="text-xs font-bold">CONFLICT DETECTED</span>
                        </div>
                    )}
                </div>

                {/* Canvas */}
                <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-bg"
                    >
                        <Controls className="!bg-surface !border-border !fill-text-main" />
                        <MiniMap
                            className="!bg-surface !border-border"
                            nodeColor={(n) => {
                                if (n.type === 'trigger') return '#ffb700';
                                if (n.type === 'condition') return '#00e5ff';
                                return '#00ff9d';
                            }}
                        />
                        <Background color="#333" gap={20} />
                    </ReactFlow>
                </div>
            </div>

            {/* Right Panel */}
            <div className="w-80 bg-surface border-l border-border flex flex-col z-10">
                {mode === 'edit' ? (
                    <PropertiesPanel
                        node={selectedNode}
                        onChange={updateNodeData}
                        onDelete={deleteNode}
                    />
                ) : (
                    <SimulationPanel state={simState} onChange={setSimState} />
                )}
            </div>
        </div>
    );
}

const PropertiesPanel = ({ node, onChange, onDelete }) => {
    if (!node) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted p-8 text-center">
                <MousePointer2 size={48} className="mb-4 opacity-20" />
                <p className="text-sm">Select a node to edit its properties</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-border">
                <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Settings size={16} /> Properties
                </h2>
            </div>
            <div className="p-4 flex-1 space-y-6">
                <div>
                    <label className="block text-xs text-text-muted mb-1.5">Label</label>
                    <input
                        type="text"
                        value={node.data.label}
                        onChange={(e) => onChange('label', e.target.value)}
                        className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs text-text-muted mb-1.5">Sub-Label</label>
                    <input
                        type="text"
                        value={node.data.subLabel || ''}
                        onChange={(e) => onChange('subLabel', e.target.value)}
                        className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none"
                    />
                </div>

                <div className="pt-4 border-t border-border">
                    <div className="text-xs text-text-muted mb-2">Node ID: <span className="font-mono text-text-main">{node.id}</span></div>
                    <div className="text-xs text-text-muted">Type: <span className="font-mono text-text-main">{node.type}</span></div>
                </div>
            </div>
            <div className="p-4 border-t border-border">
                <button
                    onClick={onDelete}
                    className="w-full flex items-center justify-center gap-2 bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 py-2 rounded text-sm transition-colors"
                >
                    <Trash2 size={16} /> Delete Node
                </button>
            </div>
        </div>
    );
};

const SimulationPanel = ({ state, onChange }) => {
    return (
        <div className="flex flex-col h-full bg-surface">
            <div className="p-4 border-b border-border bg-primary/5">
                <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-primary">
                    <Play size={16} /> Live Simulation
                </h2>
            </div>

            <div className="p-4 flex-1 space-y-8">
                {/* Battery Control */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-text-muted flex items-center gap-2">
                            <Battery size={14} /> DRONE BATTERY
                        </label>
                        <span className={`text-xs font-mono ${state.battery < 20 ? 'text-danger' : 'text-success'}`}>
                            {state.battery}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={state.battery}
                        onChange={(e) => onChange({ ...state, battery: parseInt(e.target.value) })}
                        className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-text-muted mt-1">
                        <span>Critical (0%)</span>
                        <span>Full (100%)</span>
                    </div>
                </div>

                {/* Location Control */}
                <div>
                    <label className="text-xs font-bold text-text-muted flex items-center gap-2 mb-3">
                        <Map size={14} /> CURRENT LOCATION
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onChange({ ...state, location: 'water' })}
                            className={`p-3 rounded border text-xs font-medium transition-all ${state.location === 'water' ? 'bg-primary/20 border-primary text-primary' : 'bg-bg border-border text-text-muted hover:border-gray-600'}`}
                        >
                            Over Water
                        </button>
                        <button
                            onClick={() => onChange({ ...state, location: 'land' })}
                            className={`p-3 rounded border text-xs font-medium transition-all ${state.location === 'land' ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-bg border-border text-text-muted hover:border-gray-600'}`}
                        >
                            Over Land
                        </button>
                    </div>
                </div>

                {/* Density Control */}
                <div>
                    <label className="text-xs font-bold text-text-muted flex items-center gap-2 mb-3">
                        <Users size={14} /> POPULATION DENSITY
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onChange({ ...state, density: 'low' })}
                            className={`p-3 rounded border text-xs font-medium transition-all ${state.density === 'low' ? 'bg-success/20 border-success text-success' : 'bg-bg border-border text-text-muted hover:border-gray-600'}`}
                        >
                            Low Density
                        </button>
                        <button
                            onClick={() => onChange({ ...state, density: 'high' })}
                            className={`p-3 rounded border text-xs font-medium transition-all ${state.density === 'high' ? 'bg-danger/20 border-danger text-danger' : 'bg-bg border-border text-text-muted hover:border-gray-600'}`}
                        >
                            High Density
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-border bg-bg/30">
                <div className="text-xs text-text-muted text-center">
                    Adjust values to see logic flow update in real-time.
                </div>
            </div>
        </div>
    );
};

const SidebarItem = ({ type, label, subLabel, actionType, icon: Icon, color }) => {
    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/label', label);
        event.dataTransfer.setData('application/subLabel', subLabel || '');
        if (actionType) event.dataTransfer.setData('application/actionType', actionType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const bgClass = color.replace('text-', 'bg-') + '-dim';

    return (
        <div
            className={`flex items-center gap-3 p-3 mb-2 bg-surface border border-border rounded cursor-grab hover:border-primary transition-colors group`}
            onDragStart={(event) => onDragStart(event, type)}
            draggable
        >
            <div className={`p-2 rounded transition-all ${bgClass}`}>
                <Icon size={16} className={color} />
            </div>
            <div>
                <div className="text-sm font-medium text-text-main">{label}</div>
                {subLabel && <div className="text-xs text-text-muted">{subLabel}</div>}
            </div>
        </div>
    );
};

const Sidebar = () => {
    return (
        <aside className="w-64 bg-surface border-r border-border flex flex-col h-full z-10">
            <div className="p-4 border-b border-border flex items-center gap-2">

                <div>
                    <h1 className="text-sm font-bold text-text-main tracking-wider">Plivo Design Task</h1>
                    <p className="text-[10px] text-text-muted">PROTOCOL BUILDER</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-6">
                    <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Triggers</h2>
                    <SidebarItem type="trigger" label="Battery < 20%" subLabel="Critical Power" icon={Zap} color="text-secondary" />
                    <SidebarItem type="trigger" label="Signal Lost" subLabel="Connection Timeout" icon={Radio} color="text-secondary" />
                </div>

                <div className="mb-6">
                    <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Conditions</h2>
                    <SidebarItem type="condition" label="Location" subLabel="Terrain Analysis" icon={MapPin} color="text-primary" />
                    <SidebarItem type="condition" label="Population Density" subLabel="Safety Check" icon={Users} color="text-primary" />
                </div>

                <div className="mb-6">
                    <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Actions</h2>
                    <SidebarItem type="action" label="Hover" actionType="hover" icon={Anchor} color="text-success" />
                    <SidebarItem type="action" label="Distress Signal" actionType="signal" icon={Radio} color="text-success" />
                    <SidebarItem type="action" label="Navigate Safe Zone" actionType="navigate" icon={Shield} color="text-success" />
                    <SidebarItem type="action" label="Soft Landing" actionType="land" icon={ArrowDownCircle} color="text-success" />
                </div>
            </div>


        </aside>
    );
};

export default function LogicBuilder() {
    return (
        <ReactFlowProvider>
            <LogicBuilderContent />
        </ReactFlowProvider>
    );
}
