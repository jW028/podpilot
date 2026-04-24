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
  onImageUpload?: (file: File) => Promise<string | null>;
}

const ProductCanvas = ({
  blocks,
  onBlockUpdate,
  onBlockRemove,
  onBlockReorder,
  onImageUpload,
}: ProductCanvasProps) => {
  const [canvasBlocks, setCanvasBlocks] = useState<Block[]>(blocks);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCanvasBlocks(blocks);
    }, 0);
    return () => clearTimeout(timer);
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

  return (
    <div className="flex flex-col h-full bg-light-secondary">
      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-6">
        {canvasBlocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-neutral-500 mb-1 font-medium text-sm">
              No fields yet
            </p>
            <p className="text-xs text-neutral-400">
              Describe your product idea to the Design Agent to get started
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="canvas" type="CARD">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`grid grid-cols-4 gap-4 auto-rows-max transition-colors ${
                    snapshot.isDraggingOver
                      ? "bg-primary-100 rounded-xl p-4"
                      : ""
                  }`}
                >
                  {canvasBlocks.map((block, index) => (
                    <div key={block.id}>
                      <EditableBlock
                        block={block}
                        index={index}
                        onUpdate={onBlockUpdate}
                        onRemove={onBlockRemove}
                        onImageUpload={onImageUpload}
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
