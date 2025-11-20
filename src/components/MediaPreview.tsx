import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

export function MediaPreview({ files, onRemove }: MediaPreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-lg">
      {files.map((file, index) => (
        <div key={index} className="relative group">
          <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted">
            {file.type.startsWith("image/") ? (
              <img
                src={URL.createObjectURL(file)}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : file.type.startsWith("video/") ? (
              <video
                src={URL.createObjectURL(file)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                {file.name}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(index)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
