import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Zap, MapPin, Activity, AlertTriangle, Anchor, Radio, Shield, ArrowDownCircle } from 'lucide-react';

const NodeWrapper = ({ children, title, icon: Icon, colorClass, selected, isActive, hasConflict }) => {
    const bgClass = colorClass.replace('text-', 'bg-') + '-dim';

    return (
        <div className={`
      min-w-[200px] bg-surface border rounded-md shadow-lg transition-all duration-300
      ${hasConflict ? 'border-danger ring-1 ring-danger shadow-[0_0_15px_rgba(255,42,42,0.3)]' :
                selected ? 'ring-1 ring-primary border-primary' : 'border-border hover:border-gray-600'}
      ${isActive && !hasConflict ? 'shadow-[0_0_15px_rgba(0,229,255,0.3)] border-primary ring-1 ring-primary' : ''}
    `}>
            <div className={`
        flex items-center gap-2 px-3 py-2 border-b border-border rounded-t-md
        ${hasConflict ? 'bg-danger-dim text-danger' : `${colorClass} ${bgClass}`}
        ${isActive && !hasConflict ? 'active' : ''}
      `}>
                <Icon size={16} className={hasConflict ? 'text-danger' : colorClass} />
                <span className={`text-xs font-bold uppercase tracking-wider ${hasConflict ? 'text-danger' : 'text-text-main'}`}>{title}</span>
                {hasConflict && <AlertTriangle size={14} className="ml-auto text-danger animate-pulse" />}
                {isActive && !hasConflict && <div className="ml-auto w-2 h-2 rounded-full bg-primary animate-pulse" />}
            </div>
            <div className="p-3">
                {children}
            </div>
        </div>
    );
};

export const TriggerNode = memo(({ data, selected }) => {
    return (
        <NodeWrapper title="Trigger" icon={Zap} colorClass="text-secondary" selected={selected} isActive={data.isActive} hasConflict={data.hasConflict}>
            <div className="text-sm font-mono text-text-main mb-1">{data.label}</div>
            <div className="text-xs text-text-muted">{data.subLabel}</div>
            <Handle type="source" position={Position.Bottom} className="!bg-secondary !w-3 !h-3" />
        </NodeWrapper>
    );
});

export const ConditionNode = memo(({ data, selected }) => {
    return (
        <NodeWrapper title="Condition" icon={MapPin} colorClass="text-primary" selected={selected} isActive={data.isActive} hasConflict={data.hasConflict}>
            <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
            <div className="text-sm font-mono text-text-main mb-1">{data.label}</div>
            <div className="text-xs text-text-muted">{data.subLabel}</div>
            <div className="flex justify-between mt-3 pt-2 border-t border-border">
                <div className="relative">
                    <span className={`text-[10px] absolute -top-4 left-0 transition-colors ${data.activeBranch === 'true' ? 'text-success font-bold' : 'text-text-muted'}`}>TRUE</span>
                    <Handle type="source" position={Position.Bottom} id="true" className={`!w-3 !h-3 !left-2 transition-colors ${data.activeBranch === 'true' ? '!bg-success' : '!bg-gray-600'}`} />
                </div>
                <div className="relative">
                    <span className={`text-[10px] absolute -top-4 right-0 transition-colors ${data.activeBranch === 'false' ? 'text-danger font-bold' : 'text-text-muted'}`}>FALSE</span>
                    <Handle type="source" position={Position.Bottom} id="false" className={`!w-3 !h-3 !left-auto !right-2 transition-colors ${data.activeBranch === 'false' ? '!bg-danger' : '!bg-gray-600'}`} />
                </div>
            </div>
        </NodeWrapper>
    );
});

export const ActionNode = memo(({ data, selected }) => {
    const getIcon = () => {
        switch (data.actionType) {
            case 'hover': return Anchor;
            case 'signal': return Radio;
            case 'navigate': return Shield;
            case 'land': return ArrowDownCircle;
            default: return Activity;
        }
    };

    const Icon = getIcon();

    return (
        <NodeWrapper title="Action" icon={Icon} colorClass="text-success" selected={selected} isActive={data.isActive} hasConflict={data.hasConflict}>
            <Handle type="target" position={Position.Top} className="!bg-success !w-3 !h-3" />
            <div className="flex items-center gap-2">
                <div className="text-sm font-mono text-text-main">{data.label}</div>
            </div>
        </NodeWrapper>
    );
});
