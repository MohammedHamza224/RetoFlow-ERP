import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  FileText,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { RagService } from '@/services/rag.service';
import { useAuth } from '@/context/AuthContext';
import {
  KnowledgeDocument,
  KnowledgeCategory,
  KnowledgeSourceType,
  UserRole,
} from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

const CATEGORIES: KnowledgeCategory[] = [
  'OPERATIONS',
  'INVENTORY',
  'PURCHASING',
  'POS',
  'MANAGEMENT',
  'CANCELLATION_REFUND',
  'HR',
  'GENERAL',
];

const SOURCE_TYPES: KnowledgeSourceType[] = [
  'POLICY',
  'SOP',
  'FAQ',
  'MANUAL_TEXT',
  'CSV',
  'PDF',
  'DOCX',
];

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'CASHIER', 'STAFF'];

export function KnowledgeBaseManager() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isReindexingId, setIsReindexingId] = useState<string | null>(null);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<KnowledgeCategory>('OPERATIONS');
  const [formSourceType, setFormSourceType] = useState<KnowledgeSourceType>('SOP');
  const [formSourceName, setFormSourceName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formAllowedRoles, setFormAllowedRoles] = useState<UserRole[]>(['ADMIN', 'MANAGER']);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await DatabaseService.getKnowledgeDocuments(user?.id);
      setDocuments(docs);
    } catch (err: any) {
      console.error('Failed to load knowledge documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch =
        searchQuery === '' ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.source_name && doc.source_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat = selectedCategory === 'ALL' || doc.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [documents, searchQuery, selectedCategory]);

  const handleOpenCreate = () => {
    setEditingDoc(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('OPERATIONS');
    setFormSourceType('SOP');
    setFormSourceName('');
    setFormContent('');
    setFormAllowedRoles(['ADMIN', 'MANAGER', 'CASHIER', 'STAFF']);
    setFormIsActive(true);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (doc: KnowledgeDocument) => {
    setEditingDoc(doc);
    setFormTitle(doc.title);
    setFormDescription(doc.description || '');
    setFormCategory(doc.category);
    setFormSourceType(doc.source_type);
    setFormSourceName(doc.source_name || '');
    setFormContent(doc.content);
    setFormAllowedRoles(doc.allowed_roles || ['ADMIN', 'MANAGER']);
    setFormIsActive(doc.is_active);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleToggleRole = (role: UserRole) => {
    if (formAllowedRoles.includes(role)) {
      if (formAllowedRoles.length === 1) return; // Must have at least one role
      setFormAllowedRoles(formAllowedRoles.filter(r => r !== role));
    } else {
      setFormAllowedRoles([...formAllowedRoles, role]);
    }
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError(isRtl ? 'عنوان الوثيقة مطلوب' : 'Document title is required.');
      return;
    }
    if (!formContent.trim()) {
      setFormError(isRtl ? 'محتوى الوثيقة مطلوب' : 'Document content is required.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingDoc) {
        await DatabaseService.updateKnowledgeDocument(user?.id, editingDoc.id, {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          category: formCategory,
          source_type: formSourceType,
          source_name: formSourceName.trim() || undefined,
          content: formContent.trim(),
          allowed_roles: formAllowedRoles,
          is_active: formIsActive,
        });
      } else {
        await DatabaseService.createKnowledgeDocument(user?.id, {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          category: formCategory,
          source_type: formSourceType,
          source_name: formSourceName.trim() || undefined,
          content: formContent.trim(),
          allowed_roles: formAllowedRoles,
          is_active: formIsActive,
        });
      }

      setIsFormModalOpen(false);
      await loadDocuments();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReindex = async (docId: string) => {
    setIsReindexingId(docId);
    try {
      await DatabaseService.reindexKnowledgeDocument(user?.id, docId);
      await loadDocuments();
    } catch (err: any) {
      console.error('Re-index error:', err);
    } finally {
      setIsReindexingId(null);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await DatabaseService.deleteKnowledgeDocument(user?.id, docId);
      setDeleteConfirmId(null);
      await loadDocuments();
    } catch (err: any) {
      console.error('Delete error:', err);
    }
  };

  const previewChunks = useMemo(() => {
    if (!previewDoc) return [];
    return RagService.chunkDocument(previewDoc.content, 320, 50);
  }, [previewDoc]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-resto-terracotta-600" />
            {isRtl ? 'سجل قاعدة المعرفة التشغيلية (RAG Knowledge Base)' : 'RAG Knowledge Base Registry'}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRtl
              ? 'إدارة سياسات التشغيل، أدلة العمل، وإجراءات السلامة لتدريب ومساعدة الموظفين بالذكاء الاصطناعي'
              : 'Manage operational policies, SOPs, and refund guidelines indexed for AI RAG retrieval.'}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          leftIcon={<Plus className="w-4 h-4" />}
          className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold shrink-0 shadow-sm"
        >
          {isRtl ? 'إضافة وثيقة جديدة' : 'Add Knowledge Document'}
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isRtl ? 'البحث في عناوين ومحتوى الوثائق...' : 'Search document titles, SOPs, and policies...'}
            className="pl-9 rtl:pl-3 rtl:pr-9 h-9 text-xs bg-card"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                : 'bg-card border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isRtl ? 'الكل' : 'All'} ({documents.length})
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                  : 'bg-card border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid / Table */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card className="border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-card">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            {isRtl ? 'لم يتم العثور على وثائق مطابقة' : 'No matching knowledge documents found.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocuments.map(doc => (
            <Card
              key={doc.id}
              className={`border transition-shadow hover:shadow-subtle bg-card flex flex-col justify-between ${
                doc.is_active
                  ? 'border-slate-200 dark:border-slate-800'
                  : 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/50 dark:bg-slate-900/20'
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                        {doc.title}
                      </span>
                      {doc.is_active ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title={t('common.active')} />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" title={t('common.inactive')} />
                      )}
                    </div>
                    {doc.source_name && (
                      <span className="text-[11px] font-mono text-resto-terracotta-600 block">
                        {doc.source_name}
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold shrink-0">
                    {doc.category}
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {doc.description || doc.content}
                </p>

                {/* Badges for roles and chunks */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[10px]">
                  <span className="text-slate-400 flex items-center gap-1 mr-1">
                    <Shield className="w-3 h-3" />
                    {isRtl ? 'الصلاحيات:' : 'Access:'}
                  </span>
                  {doc.allowed_roles.map(r => (
                    <span
                      key={r}
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono"
                    >
                      {r}
                    </span>
                  ))}
                  <span className="ms-auto px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {doc.chunk_count || 1} {isRtl ? 'أجزاء متجهة' : 'chunks'}
                  </span>
                </div>
              </CardContent>

              {/* Action Buttons */}
              <div className="px-4 py-2.5 bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(doc.updated_at).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewDoc(doc)}
                    className="h-8 w-8 min-h-[36px] min-w-[36px] p-0 text-slate-500 hover:text-slate-900"
                    title={isRtl ? 'معاينة المقاطع' : 'Preview Chunks'}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReindex(doc.id)}
                    disabled={isReindexingId === doc.id}
                    className="h-8 w-8 min-h-[36px] min-w-[36px] p-0 text-slate-500 hover:text-resto-terracotta-600"
                    title={isRtl ? 'إعادة الفهرسة المتجهة' : 'Re-index Vector'}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isReindexingId === doc.id ? 'animate-spin text-resto-terracotta-600' : ''}`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(doc)}
                    className="h-8 w-8 min-h-[36px] min-w-[36px] p-0 text-slate-500 hover:text-blue-600"
                    title={isRtl ? 'تعديل' : 'Edit'}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmId(doc.id)}
                    className="h-8 w-8 min-h-[36px] min-w-[36px] p-0 text-slate-500 hover:text-red-600"
                    title={isRtl ? 'حذف' : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Document Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={
          editingDoc
            ? (isRtl ? 'تعديل وثيقة معرفة' : 'Edit Knowledge Document')
            : (isRtl ? 'إضافة وثيقة تشغيلية جديدة' : 'Add Operational Document')
        }
        description={
          isRtl
            ? 'أدخل بيانات الوثيقة والسياسة التشغيلية ليتم تحويلها إلى متجهات وتضمينها في RAG'
            : 'Configure SOP or policy details to be chunked, embedded, and retrieved by the AI Assistant.'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveDocument} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 text-xs border border-red-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRtl ? 'عنوان الوثيقة *' : 'Document Title *'}
              </label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder={isRtl ? 'مثال: سياسة إلغاء الطلبات واسترداد الأموال' : 'e.g. Order Cancellation & Refund SOP'}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRtl ? 'الوصف المختصر' : 'Short Description'}
              </label>
              <Input
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder={isRtl ? 'ملخص سريع لمحتوى الوثيقة' : 'Brief overview of policy contents'}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRtl ? 'التصنيف' : 'Category'}
              </label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value as KnowledgeCategory)}
                className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-background px-3 text-xs"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRtl ? 'نوع المصدر' : 'Source Type'}
              </label>
              <select
                value={formSourceType}
                onChange={e => setFormSourceType(e.target.value as KnowledgeSourceType)}
                className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-background px-3 text-xs"
              >
                {SOURCE_TYPES.map(st => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRtl ? 'معرف المرجع / رقم الوثيقة' : 'Source Document Reference / Code'}
              </label>
              <Input
                value={formSourceName}
                onChange={e => setFormSourceName(e.target.value)}
                placeholder={isRtl ? 'مثال: SOP-OPS-001' : 'e.g. RestoFlow SOP-OPS-001'}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRtl ? 'الأدوار المصرح لها بالوصول إلى هذه الوثيقة (RBAC)' : 'Permitted Roles (RBAC Filter)'}
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {ROLES.map(role => {
                  const isSelected = formAllowedRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleToggleRole(role)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        isSelected
                          ? 'bg-resto-charcoal-800 text-white border-resto-charcoal-800 dark:bg-slate-700 dark:border-slate-700'
                          : 'bg-card border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRtl ? 'نص الوثيقة الكامل (سيتم تقسيمه وتضمينه تلقائياً) *' : 'Full Document Content (Auto-chunked & vectorized) *'}
              </label>
              <textarea
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                rows={6}
                placeholder={
                  isRtl
                    ? 'اكتب هنا السياسة أو الإجراء التشغيلي بالتفصيل...'
                    : 'Paste the exact standard operating procedure or policy here...'
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-background p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-resto-terracotta-500"
                required
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                id="docActiveToggle"
                checked={formIsActive}
                onChange={e => setFormIsActive(e.target.checked)}
                className="rounded border-slate-300 text-resto-terracotta-600 focus:ring-resto-terracotta-500 h-4 w-4"
              />
              <label htmlFor="docActiveToggle" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {isRtl ? 'الوثيقة نشطة ومتاحة للاسترجاع بواسطة RAG' : 'Document is Active and indexed for RAG'}
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFormModalOpen(false)}
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSaving}
              className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
            >
              {isSaving
                ? (isRtl ? 'جاري الحفظ والفهرسة...' : 'Indexing...')
                : (isRtl ? 'حفظ وتضمين' : 'Save & Index')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Chunk Preview Modal */}
      <Modal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || ''}
        description={isRtl ? 'معاينة المقاطع النصية والمتجهات (Chunks & Vectors)' : 'Text Chunks & 768-dim Vector Embeddings'}
        maxWidth="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="text-xs text-slate-500">
            {isRtl
              ? `تم تقسيم هذه الوثيقة إلى ${previewChunks.length} مقاطع متداخلة باستخدام خوارزمية النافذة المنزلقة (Sliding Window):`
              : `This document is split into ${previewChunks.length} semantic overlapping chunks:`}
          </div>

          <div className="space-y-3">
            {previewChunks.map((chunk, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-resto-terracotta-600 font-bold">
                  <span>Chunk #{idx + 1}</span>
                  <span className="text-slate-400 font-normal">{chunk.length} chars • vector(768)</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                  {chunk}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title={isRtl ? 'تأكيد حذف الوثيقة' : 'Confirm Document Deletion'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {isRtl
              ? 'هل أنت متأكد من حذف هذه الوثيقة؟ سيتم حذف جميع المتجهات المرتبطة بها ولن تعد متاحة للمساعد الذكي.'
              : 'Are you sure you want to delete this document? All associated vector embeddings will be permanently removed from the RAG index.'}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-500 text-white font-bold"
            >
              {isRtl ? 'حذف نهائي' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
