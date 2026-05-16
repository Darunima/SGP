import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Download, File, FileText, FileImage,
  FileVideo, FileCode, Archive, Trash2, Search, FolderOpen
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(fileType: string, fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || fileType.startsWith('image/')) return FileImage;
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext) || fileType.startsWith('video/')) return FileVideo;
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'go', 'rs', 'html', 'css'].includes(ext)) return FileCode;
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return Archive;
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return FileText;
  return File;
}

function getFileColor(fileType: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || fileType.startsWith('image/')) return 'text-pink-400';
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext) || fileType.startsWith('video/')) return 'text-purple-400';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'go', 'rs', 'html', 'css'].includes(ext)) return 'text-blue-400';
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return 'text-yellow-400';
  if (['pdf', 'doc', 'docx'].includes(ext)) return 'text-red-400';
  return 'text-slate-400';
}

export default function FilesPage() {
  const { activeWorkspace, files, uploadFile, members } = useWorkspace();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = files.filter(f =>
    f.file_name.toLowerCase().includes(search.toLowerCase()) ||
    f.uploader?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleFiles(fileList: FileList) {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      await uploadFile(file);
    }
    setUploading(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) await handleFiles(e.dataTransfer.files);
  }

  async function handleDelete(fileId: string, fileUrl: string) {
    const path = fileUrl.split('/project-files/')[1];
    if (path) await supabase.storage.from('project-files').remove([path]);
    await supabase.from('files').delete().eq('id', fileId);
  }

  const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0);

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Select a workspace to view files</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Files</h1>
          <p className="text-slate-400 text-sm mt-0.5">{files.length} files · {formatBytes(totalSize)} total</p>
        </div>
        <label
          htmlFor="workspace-file-upload-input"
          className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all ${uploading ? 'cursor-not-allowed opacity-60 pointer-events-none' : ''}`}
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : <Upload size={15} />}
          {uploading ? 'Uploading...' : 'Upload File'}
        </label>
        <input id="workspace-file-upload-input" ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search files..."
          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      {/* Drop Zone */}
      <motion.div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        animate={{ borderColor: dragOver ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)' }}
        className="border-2 border-dashed rounded-2xl p-8 text-center transition-colors"
      >
        <Upload size={28} className={`mx-auto mb-3 transition-colors ${dragOver ? 'text-blue-400' : 'text-slate-600'}`} />
        <p className={`text-sm transition-colors ${dragOver ? 'text-blue-300' : 'text-slate-500'}`}>
          Drop files here to upload
        </p>
      </motion.div>

      {/* Files Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <FolderOpen size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-500 text-sm">{search ? 'No files match your search' : 'No files uploaded yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((file, idx) => {
              const Icon = getFileIcon(file.file_type, file.file_name);
              const iconColor = getFileColor(file.file_type, file.file_name);
              const isOwner = file.uploaded_by === user?.id;

              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 hover:bg-white/[0.05] transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{file.file_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatBytes(file.file_size)} · {formatDate(file.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                    <img
                      src={file.uploader?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=U`}
                      alt={file.uploader?.full_name || 'Unknown'} className="w-5 h-5 rounded-full"
                    />
                    <span className="text-xs text-slate-500 flex-1 truncate">{file.uploader?.full_name || 'Unknown'}</span>
                    <div className="flex items-center gap-1">
                      <a href={file.file_url} target="_blank" rel="noopener noreferrer" download={file.file_name}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                        <Download size={13} />
                      </a>
                      {isOwner && (
                        <button onClick={() => handleDelete(file.id, file.file_url)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
