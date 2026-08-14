import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Grid,
  List,
  UtensilsCrossed,
  AlertTriangle,
  Edit2,
  Power,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Product, Category } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductCard } from './ProductCard';
import { ProductFormModal } from './ProductFormModal';

export function ProductManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  // Instant Synchronous Cache Initialization for 0ms Instant Render
  const cachedProds = DatabaseService.getCachedProductsSync();
  const cachedCats = DatabaseService.getCachedCategoriesSync();

  const [products, setProducts] = useState<Product[]>(cachedProds || []);
  const [categories, setCategories] = useState<Category[]>(cachedCats || []);
  const [isLoading, setIsLoading] = useState(!cachedProds || cachedProds.length === 0);

  // View Layout Mode (Grid vs Table List)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'updated'>('name');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const loadData = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        DatabaseService.getProducts(),
        DatabaseService.getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err: any) {
      console.error('Failed to load menu products:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // If no cache was present, show skeleton, otherwise fetch silently in background
    loadData(!cachedProds || cachedProds.length === 0);
  }, [cachedProds, loadData]);

  const openCreateModal = useCallback(() => {
    setEditingProduct(null);
    setIsModalOpen(true);
  }, []);

  const handleFormSubmit = async (formData: any, imageFile: File | null) => {
    try {
      let finalImageUrl = formData.image_url;

      // 1. If an image file was selected, upload it
      if (imageFile) {
        finalImageUrl = await DatabaseService.uploadProductImage(imageFile);
      } 
      // 2. If the user cleared the image (and didn't select a new one), we should delete the old one
      else if (editingProduct && editingProduct.image_url && !formData.image_url) {
        // The user explicitly removed the image
        // Wait to delete it until AFTER the database update succeeds
      }

      const payload = { ...formData, image_url: finalImageUrl };

      if (editingProduct) {
        const updated = await DatabaseService.updateProduct(user?.id, editingProduct.id, payload);
        
        // If image was removed or replaced, delete the old image from storage
        if (editingProduct.image_url && editingProduct.image_url !== finalImageUrl) {
          await DatabaseService.deleteProductImage(editingProduct.image_url);
        }

        setProducts(prev => prev.map(p => p.id === editingProduct.id ? updated : p));
      } else {
        const created = await DatabaseService.createProduct(user?.id, payload);
        setProducts(prev => [...prev, created]);
      }

      // Close the modal upon success
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save product:', err);
      throw err; // Re-throw to be handled by the form modal
    }
  };

  const openEditModal = useCallback((prod: Product) => {
    setEditingProduct(prod);
    setIsModalOpen(true);
  }, []);

  // Optimistic Local Status Toggle (0ms UI response)
  const handleToggleStatus = useCallback(async (prod: Product) => {
    if (!isManagerOrAdmin) return;

    // 1. Instant local update
    setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, is_active: !p.is_active } : p));

    // 2. Persist in database asynchronously
    try {
      await DatabaseService.toggleProductStatus(user?.id, prod.id);
    } catch (err: any) {
      // Rollback on failure
      setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, is_active: prod.is_active } : p));
      alert(err.message || 'Failed to toggle product status.');
    }
  }, [isManagerOrAdmin, user]);

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    return products.filter(p => {
      const matchesSearch = !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term));

      const matchesCategory = selectedCategory === 'ALL' || p.category_id === selectedCategory;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && p.is_active) ||
        (statusFilter === 'INACTIVE' && !p.is_active);

      let matchesStock = true;
      if (stockFilter === 'OUT_OF_STOCK') matchesStock = p.stock_quantity === 0;
      else if (stockFilter === 'LOW_STOCK') matchesStock = p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock;
      else if (stockFilter === 'IN_STOCK') matchesStock = p.stock_quantity > p.minimum_stock;

      return matchesSearch && matchesCategory && matchesStatus && matchesStock;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'stock') return a.stock_quantity - b.stock_quantity;
      if (sortBy === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      return 0;
    });
  }, [products, deferredSearchTerm, selectedCategory, statusFilter, stockFilter, sortBy]);

  // Inventory Stock Metrics Counter
  const lowStockCount = useMemo(() => products.filter(p => p.is_active && p.stock_quantity > 0 && p.stock_quantity <= p.minimum_stock).length, [products]);
  const outOfStockCount = useMemo(() => products.filter(p => p.is_active && p.stock_quantity === 0).length, [products]);

  return (
    <div className="space-y-6">
      {/* Header & Primary Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-resto-terracotta-600" />
            Restaurant Menu Catalog
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage products, pricing, stock levels, and soft deactivation status ({products.length} Products Total)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-resto-terracotta-600 shadow-sm' : 'text-slate-400'
              }`}
              title="Grid Card View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-resto-terracotta-600 shadow-sm' : 'text-slate-400'
              }`}
              title="Table List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {isManagerOrAdmin && (
            <Button
              variant="primary"
              size="md"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Product
            </Button>
          )}
        </div>
      </div>

      {/* Stock Alerts Teaser Widget */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold">Inventory Alerts:</span>
          {lowStockCount > 0 && (
            <span className="bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded font-semibold text-amber-800 dark:text-amber-300">
              {lowStockCount} Low Stock Items
            </span>
          )}
          {outOfStockCount > 0 && (
            <span className="bg-red-100 dark:bg-red-900/60 px-2 py-0.5 rounded font-semibold text-red-800 dark:text-red-300">
              {outOfStockCount} Out of Stock
            </span>
          )}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <Input
            placeholder="Search name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
          >
            <option value="ALL">All Stock Levels</option>
            <option value="IN_STOCK">In Stock Only</option>
            <option value="LOW_STOCK">Low Stock Triggered</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
          >
            <option value="name">Sort by Name (A-Z)</option>
            <option value="price">Sort by Price</option>
            <option value="stock">Sort by Stock Quantity</option>
            <option value="updated">Sort by Recently Updated</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredProducts.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            No Products Found
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No items match your search term or active filter preferences.
          </p>
        </div>
      )}

      {/* Grid Card View */}
      {!isLoading && viewMode === 'grid' && filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              isManagerOrAdmin={isManagerOrAdmin}
              onEdit={openEditModal}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Table List View */}
      {!isLoading && viewMode === 'table' && filteredProducts.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">SKU</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Price</th>
                  {isManagerOrAdmin && <th className="p-3.5">Cost</th>}
                  <th className="p-3.5">Stock</th>
                  <th className="p-3.5">Status</th>
                  {isManagerOrAdmin && <th className="p-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="p-3.5 font-bold text-resto-charcoal-900 dark:text-slate-100">
                      {p.name}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">{p.sku}</td>
                    <td className="p-3.5">{p.category?.name || 'Unassigned'}</td>
                    <td className="p-3.5 font-bold text-resto-terracotta-600">{formatCurrency(p.price)}</td>
                    {isManagerOrAdmin && <td className="p-3.5 text-slate-500">{formatCurrency(p.cost)}</td>}
                    <td className="p-3.5 font-semibold">
                      {p.stock_quantity} <span className="text-[10px] text-slate-400 font-normal">(Min: {p.minimum_stock})</span>
                    </td>
                    <td className="p-3.5">
                      <Badge variant={p.is_active ? 'success' : 'outline'}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    {isManagerOrAdmin && (
                      <td className="p-3.5 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(p)} leftIcon={<Edit2 className="w-3.5 h-3.5" />}>
                          Edit
                        </Button>
                        <Button
                          variant={p.is_active ? 'outline' : 'secondary'}
                          size="sm"
                          onClick={() => handleToggleStatus(p)}
                          leftIcon={<Power className="w-3.5 h-3.5" />}
                          className={p.is_active ? 'text-amber-600' : 'text-emerald-600'}
                        >
                          {p.is_active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        categories={categories}
        editingProduct={editingProduct}
      />
    </div>
  );
}
