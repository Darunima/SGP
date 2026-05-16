import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileText, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadZoneProps {
  onFileSelected: (files: File[]) => void;
  isLoading?: boolean;
  uploadProgress?: number;
  supportedFormats?: string[];
  maxFileSize?: number;
  multiple?: boolean;
}

const MAX_FILE_SIZE = 50; // 50MB

export function FileUploadZone({
  onFileSelected,
  isLoading = false,
  uploadProgress = 0,
  supportedFormats,
  maxFileSize = MAX_FILE_SIZE,
  multiple = true,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: File[]): boolean => {
    setError(null);
    for (const file of files) {
      if (file.size > maxFileSize * 1024 * 1024) {
        setError(`File "${file.name}" exceeds ${maxFileSize}MB limit`);
        return false;
      }
    }
    return true;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    if (!multiple && fileArray.length > 0) {
      fileArray.splice(1);
    }

    const nextFiles = multiple ? [...selectedFiles, ...fileArray] : fileArray;

    if (validateFiles(nextFiles)) {
      setSelectedFiles(nextFiles);
      onFileSelected(nextFiles);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-white/20 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          hidden
          onChange={e => handleFiles(e.target.files)}
        />

        <motion.div
          animate={{ scale: isDragging ? 1.05 : 1 }}
          className="flex flex-col items-center justify-center gap-3"
        >
          <motion.div
            animate={{ y: isDragging ? -4 : 0 }}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600/20 to-blue-600/5 border border-blue-500/20 flex items-center justify-center"
          >
            <Upload size={24} className="text-blue-400" />
          </motion.div>

          <div className="text-center">
            <p className="text-sm font-medium text-white">
              {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Any file type supported
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Max {maxFileSize}MB per file
            </p>
          </div>
        </motion.div>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="text-blue-400 animate-spin" />
              <span className="text-sm text-white font-medium">{uploadProgress}%</span>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Files Preview */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <p className="text-xs font-medium text-slate-400">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </p>
            {selectedFiles.map((file, idx) => (
              <motion.div
                key={`${file.name}-${idx}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/10 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                {isLoading && uploadProgress < 100 ? (
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      />
                    </div>
                  </div>
                ) : isLoading ? (
                  <Loader2 size={16} className="text-blue-400 animate-spin flex-shrink-0" />
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => removeFile(idx)}
                    className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all flex-shrink-0"
                  >
                    <X size={16} />
                  </motion.button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FileUploadProgressBar({
  isVisible,
  progress,
  fileName,
}: {
  isVisible: boolean;
  progress: number;
  fileName?: string;
}) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-400">
              {fileName ? `Uploading: ${fileName}` : 'Uploading...'}
            </p>
            <p className="text-xs font-medium text-blue-400">{progress}%</p>
          </div>
          <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 100 }}
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
