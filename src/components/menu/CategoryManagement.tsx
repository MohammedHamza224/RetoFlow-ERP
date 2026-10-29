import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Power, Layers, Package, AlertCircle } from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Category, Product } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

export function CategoryManagement() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  // Instant Synchronous Cache Initialization for 0ms Instant Render
  const cachedCats = DatabaseService.getCachedCategoriesSync();
  const cachedProds = DatabaseService.getCachedProductsSync();

  const [categories, setCategories] = useState<Category[]>(cachedCats || []);
  const [products, setProducts] = useState<Product[]>(cachedProds || []);
  const [isLoading, setIsLoading] = useState(!cachedCats || cachedCats.length === 0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    is_active: true,
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        DatabaseService.getCategories(),
        DatabaseService.getProducts(),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // If no cache was present, show skeleton, otherwise fetch silently in background
    const cached = DatabaseService.getCachedCategoriesSync();
    loadData(!cached || cached.length === 0);
  }, [loadData]);

  // Memoized product count map by category ID
  const productCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      if (p.category_id) {
        map[p.category_id] = (map[p.category_id] || 0) + 1;
      }
    }
    return map;
  }, [products]);

  const openCreateModal = useCallback(() => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', image_url: '', is_active: true });
    setFormError('');
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || '',
      image_url: cat.image_url || '',
      is_active: cat.is_active,
    });
    setFormError('');
    setIsModalOpen(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError(t('menu.categoryNameRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        const updated = await DatabaseService.updateCategory(user?.id, editingCategory.id, formData);
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? updated : c));
      } else {
        const created = await DatabaseService.createCategory(user?.id, formData);
        setCategories(prev => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || (isRtl ? 'فشلت العملية.' : 'Operation failed.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Optimistic Local Status Toggle (0ms UI latency)
  const handleToggleStatus = useCallback(async (cat: Category) => {
    if (!isManagerOrAdmin) return;

    // 1. Instant local update
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c));

    // 2. Persist in database asynchronously
    try {
      await DatabaseService.toggleCategoryStatus(user?.id, cat.id);
    } catch (err: any) {
      // Rollback on failure
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: cat.is_active } : c));
      alert(err.message || (isRtl ? 'فشل تبديل حالة التصنيف.' : 'Failed to toggle category status.'));
    }
  }, [isManagerOrAdmin, user, isRtl]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    return categories.filter(c => {
      const matchesSearch = !term ||
        c.name.toLowerCase().includes(term) ||
        (c.description && c.description.toLowerCase().includes(term));
      
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && c.is_active) ||
        (statusFilter === 'INACTIVE' && !c.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [categories, deferredSearchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-resto-terracotta-600" />
            {t('menu.categoriesTitle')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('menu.categoriesSubtitle')} ({categories.length} {t('menu.productsTotal')})
          </p>
        </div>

        {isManagerOrAdmin && (
          <Button
            variant="primary"
            size="md"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('menu.createCategory')}
          </Button>
        )}
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder={t('menu.searchCategories')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-500">{t('common.filter')}:</span>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === status
                  ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? t('common.all') : (status === 'ACTIVE' ? t('common.active') : t('common.inactive'))}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredCategories.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            {t('menu.noCategories')}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'ALL'
              ? t('menu.noCategoriesDesc')
              : (isRtl ? 'ابدأ بإضافة تصنيفات القائمة لتنظيم أصناف المطعم.' : 'Start by adding menu categories to structure your restaurant catalog.')}
          </p>
        </div>
      )}

      {/* Category Grid */}
      {!isLoading && filteredCategories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((cat) => {
            const count = productCountMap[cat.id] || 0;
            return (
              <Card
                key={cat.id}
                className={`relative overflow-hidden transition-all border ${
                  !cat.is_active ? 'opacity-70 bg-slate-50 dark:bg-slate-900/50' : 'bg-card'
                }`}
              >
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">{cat.name}</CardTitle>
                      <Badge variant={cat.is_active ? 'success' : 'outline'} className="text-[10px] shrink-0">
                        {cat.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </div>
                    {cat.description && (
                      <CardDescription className="line-clamp-2 text-xs">
                        {cat.description}
                      </CardDescription>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                    <Package className="w-4 h-4 text-resto-terracotta-600 shrink-0" />
                    <span className="font-semibold">{count} {t('menu.productsCount')}</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-500 truncate">
                      {count > 0 ? t('menu.assigned') : t('menu.empty')}
                    </span>
                  </div>
                </CardContent>

                {isManagerOrAdmin && (
                  <CardFooter className="pt-3 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(cat)}
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                    >
                      {t('common.edit')}
                    </Button>

                    <Button
                      variant={cat.is_active ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleStatus(cat)}
                      leftIcon={<Power className="w-3.5 h-3.5" />}
                      className={cat.is_active ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600'}
                    >
                      {cat.is_active ? t('menu.deactivate') : t('menu.reactivate')}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? t('menu.editCategory') : t('menu.createCategory')}
        description={isRtl ? 'تنظيم أصناف القائمة لشاشة نقطة البيع وتتبع المخزون.' : 'Categories organize menu items for POS display and inventory tracking.'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('menu.categoryName')} *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={isRtl ? 'مثال: برجر، بيتزا، مشروبات' : 'e.g. Burgers, Pizza, Drinks'}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('menu.categoryDescription')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={isRtl ? 'وصف اختياري للتصنيف...' : 'Optional category description...'}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('menu.categoryImageUrl')}</label>
            <Input
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-slate-300 text-resto-terracotta-600 focus:ring-resto-terracotta-500"
              />
              <span>{t('menu.categoryActiveLabel')}</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>

            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
              {t('menu.saveCategory')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
