"use client";

import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, DropResult } from "react-beautiful-dnd";
import EditableBlock, { Block } from "@/components/ui/products/EditableBlock";

interface ProductCanvasProps {
  blocks: Block[];
  onBlockUpdate: (block: Block) => void;
  onBlockRemove: (blockId: string) => void;
  onBlockReorder?: (blocks: Block[]) => void;
  onBlockAdd?: (block: Block) => void;
}

const ProductCanvas = ({
  blocks,
  onBlockUpdate,
  onBlockRemove,
  onBlockReorder,
  onBlockAdd,
}: ProductCanvasProps) => {
  const [canvasBlocks, setCanvasBlocks] = useState<Block[]>(blocks);
  const [gridSize, setGridSize] = useState(4);

  useEffect(() => {
    setCanvasBlocks(blocks);
  }, [blocks]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (
      source.droppableId === "canvas" &&
      destination.droppableId === "canvas"
    ) {
      const newBlocks = Array.from(canvasBlocks);
      const [movedBlock] = newBlocks.splice(source.index, 1);
      newBlocks.splice(destination.index, 0, movedBlock);

      setCanvasBlocks(newBlocks);
      onBlockReorder?.(newBlocks);
    }
  };

  const handleAddAttributeBlock = () => {
    const newBlock: Block = {
      id: `attr_${Date.now()}`,
      name: "new_attribute",
      type: "text",
      label: "New Attribute",
      value: "",
      placeholder: "Enter value...",
    };
    setCanvasBlocks([...canvasBlocks, newBlock]);
    onBlockAdd?.(newBlock);
  };

  const gridColsClass =
    {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
    }[gridSize] || "grid-cols-4";

  return (
    <div className="flex flex-col h-full bg-light-secondary">
      {/* Toolbar */}
      <div className="border-b border-neutral-300 p-4 bg-white flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-dark">Columns:</label>
            <input
              type="range"
              min="1"
              max="4"
              value={gridSize}
              onChange={(e) => setGridSize(parseInt(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-neutral-600">{gridSize}</span>
          </div>
        </div>

        <button
          onClick={handleAddAttributeBlock}
          className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
        >
          + Add Field
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-6">
        {canvasBlocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-neutral-500 mb-2">No fields yet</p>
            <p className="text-xs text-neutral-400">
              Click &quot;Add Field&quot; or select a Printify product to add
              fields
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="canvas" type="CARD">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`grid ${gridColsClass} gap-4 auto-rows-max ${
                    snapshot.isDraggingOver ? "bg-blue-50 rounded-lg p-4" : ""
                  }`}
                >
                  {canvasBlocks.map((block, index) => (
                    <div key={block.id}>
                      <EditableBlock
                        block={block}
                        index={index}
                        onUpdate={onBlockUpdate}
                        onRemove={onBlockRemove}
                      />
                    </div>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
};

export default ProductCanvas;
