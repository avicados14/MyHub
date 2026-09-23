import { Box, CircleAlert, Minus, Pencil, Plus, Refrigerator, Snowflake, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, Field, Modal, PageHeader, SegmentedControl, StatusBadge } from '../../components/ui'
import { GROCERY_UNIT_OPTIONS, canonicalizeIngredientName, isValidGroceryQuantity } from '../../domain/grocery'
import type { GroceryCategory, PantryItem, StorageLocation } from '../../domain/types'
import { makeId } from '../../utilities/date'
import '../../styles/grocery-v2.css'

const LOCATIONS: StorageLocation[] = ['Pantry', 'Refrigerator', 'Freezer']
const FALLBACK_CATEGORIES: GroceryCategory[] = [
  'Produce',
  'Meat & Seafood',
  'Dairy',
  'Bakery',
  'Frozen',
  'Pantry',
  'Snacks',
  'Household',
  'Other',
]

export default function PantryPage() {
  const { data, updateData } = useApp()
  const [location, setLocation] = useState('All')
  const [editing, setEditing] = useState<PantryItem | 'new' | null>(null)
  const categories = data.settings.groceryCategories
    .filter((category) => category.enabled)
    .toSorted((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => category.name)
  const availableCategories = categories.length ? categories : FALLBACK_CATEGORIES
  const items = data.pantry.filter((item) => location === 'All' || item.location === location)

  const saveItem = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const timestamp = new Date().toISOString()
    const name = String(values.get('name') ?? '').trim()
    const quantity = Number(values.get('quantity'))
    const unit = String(values.get('unit') ?? '').trim()
    if (!name || !unit || !isValidGroceryQuantity(quantity)) return
    const existing = editing === 'new' ? null : editing
    const item: PantryItem = {
      id: existing?.id ?? makeId('pantry'),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      source: existing?.source ?? 'manual',
      name,
      canonicalName: canonicalizeIngredientName(name),
      quantity,
      unit,
      category: String(values.get('category')) as GroceryCategory,
      location: String(values.get('location')) as StorageLocation,
      expirationDate: String(values.get('expirationDate') || '') || undefined,
      notes: String(values.get('notes') || '').trim() || undefined,
    }
    updateData(
      (previous) => ({
        ...previous,
        pantry: existing
          ? previous.pantry.map((entry) => (entry.id === existing.id ? item : entry))
          : [...previous.pantry, item],
      }),
      existing ? `${name} updated.` : `${name} added to ${item.location.toLowerCase()}.`,
    )
    setEditing(null)
  }

  const adjustQuantity = (item: PantryItem, delta: number) => {
    const quantity = Math.max(0, Math.round((item.quantity + delta + Number.EPSILON) * 100) / 100)
    updateData(
      (previous) => ({
        ...previous,
        pantry: previous.pantry.map((entry) =>
          entry.id === item.id ? { ...entry, quantity, updatedAt: new Date().toISOString() } : entry,
        ),
      }),
      `${item.name} quantity is now ${quantity} ${item.unit}.`,
    )
  }

  const removeItem = (item: PantryItem) => {
    if (!window.confirm(`Remove “${item.name}” from your inventory?`)) return
    updateData(
      (previous) => ({ ...previous, pantry: previous.pantry.filter((entry) => entry.id !== item.id) }),
      `${item.name} removed.`,
    )
  }

  const locationSummary = (place: StorageLocation) => data.pantry.filter((item) => item.location === place).length

  return (
    <>
      <PageHeader
        title="Pantry"
        description="Edit what is on hand so grocery planning can make accurate, opt-in deductions."
        action={
          <button className="button button--primary" type="button" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" /> Add item
          </button>
        }
      />
      <div className="inventory-summary">
        <Card>
          <span className="section-icon section-icon--yellow">
            <Box aria-hidden="true" />
          </span>
          <div>
            <span>Pantry</span>
            <strong>{locationSummary('Pantry')}</strong>
            <small>items</small>
          </div>
        </Card>
        <Card>
          <span className="section-icon section-icon--mint">
            <Refrigerator aria-hidden="true" />
          </span>
          <div>
            <span>Refrigerator</span>
            <strong>{locationSummary('Refrigerator')}</strong>
            <small>items</small>
          </div>
        </Card>
        <Card>
          <span className="section-icon section-icon--blue">
            <Snowflake aria-hidden="true" />
          </span>
          <div>
            <span>Freezer</span>
            <strong>{locationSummary('Freezer')}</strong>
            <small>items</small>
          </div>
        </Card>
      </div>
      <div className="subnav-row">
        <SegmentedControl
          label="Pantry location"
          value={location}
          onChange={setLocation}
          options={['All', ...LOCATIONS].map((value) => ({ value, label: value }))}
        />
      </div>
      <Card className="inventory-table-card">
        <div className="inventory-table__header">
          <span>Ingredient</span>
          <span>Amount</span>
          <span>Location</span>
          <span>Freshness</span>
          <span>Actions</span>
        </div>
        <div className="inventory-list">
          {items.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.category}
                  {item.notes ? ` · ${item.notes}` : ''}
                </small>
              </div>
              <div className="quantity-adjuster" aria-label={`Adjust ${item.name} quantity`}>
                <button
                  type="button"
                  aria-label={`Decrease ${item.name}`}
                  onClick={() => adjustQuantity(item, -1)}
                  disabled={item.quantity <= 0}
                >
                  <Minus aria-hidden="true" />
                </button>
                <span>
                  {item.quantity} {item.unit}
                </span>
                <button type="button" aria-label={`Increase ${item.name}`} onClick={() => adjustQuantity(item, 1)}>
                  <Plus aria-hidden="true" />
                </button>
              </div>
              <StatusBadge
                tone={item.location === 'Refrigerator' ? 'food' : item.location === 'Freezer' ? 'study' : 'attention'}
              >
                {item.location}
              </StatusBadge>
              <span>
                {item.expirationDate
                  ? `Use by ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${item.expirationDate}T12:00:00`))}`
                  : 'No date set'}
              </span>
              <div className="inventory-row-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Edit ${item.name}`}
                  onClick={() => setEditing(item)}
                >
                  <Pencil aria-hidden="true" />
                </button>
                <button
                  className="icon-button icon-button--danger"
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => removeItem(item)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
        {!items.length ? (
          <EmptyState
            title={data.pantry.length ? `No items in ${location}` : 'Your pantry is empty'}
            detail={
              data.pantry.length
                ? 'Choose another location or add an item here.'
                : 'Add ingredients, exact amounts, storage locations, dates, and notes. You can edit everything later.'
            }
            action={
              !data.pantry.length ? (
                <button className="button button--primary" type="button" onClick={() => setEditing('new')}>
                  Add your first item
                </button>
              ) : undefined
            }
          />
        ) : null}
      </Card>
      <Card className="inventory-tip">
        <CircleAlert aria-hidden="true" />
        <div>
          <strong>Inventory changes only when you choose.</strong>
          <p>
            Quantity buttons stop at zero. Generating a grocery list never subtracts food, and a completed trip adds
            only confirmed purchases.
          </p>
        </div>
      </Card>
      <PantryItemModal
        item={editing}
        categories={availableCategories}
        onClose={() => setEditing(null)}
        onSave={saveItem}
      />
    </>
  )
}

function PantryItemModal({
  item,
  categories,
  onClose,
  onSave,
}: {
  item: PantryItem | 'new' | null
  categories: GroceryCategory[]
  onClose: () => void
  onSave: (form: HTMLFormElement) => void
}) {
  const existing = item === 'new' || item === null ? null : item
  return (
    <Modal
      open={item !== null}
      title={existing ? 'Edit pantry item' : 'Add pantry item'}
      description="Every field can be corrected later. Quantity must be zero or greater."
      onClose={onClose}
    >
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(event.currentTarget)
        }}
      >
        <Field label="Item name">
          <input
            name="name"
            required
            maxLength={120}
            autoComplete="off"
            placeholder="Chicken breast…"
            defaultValue={existing?.name ?? ''}
          />
        </Field>
        <div className="form-grid__split">
          <Field label="Quantity">
            <input
              name="quantity"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              required
              defaultValue={existing?.quantity ?? 1}
            />
          </Field>
          <Field label="Unit">
            <select name="unit" required defaultValue={existing?.unit ?? 'each'}>
              {GROCERY_UNIT_OPTIONS.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-grid__split">
          <Field label="Location">
            <select name="location" defaultValue={existing?.location ?? 'Pantry'}>
              {LOCATIONS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select name="category" defaultValue={existing?.category ?? categories[0] ?? 'Other'}>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Expiration date (optional)">
          <input name="expirationDate" type="date" defaultValue={existing?.expirationDate ?? ''} />
        </Field>
        <Field label="Notes">
          <textarea
            name="notes"
            maxLength={500}
            rows={3}
            placeholder="Opened package, top shelf…"
            defaultValue={existing?.notes ?? ''}
          />
        </Field>
        <div className="modal__actions">
          <button className="button button--quiet" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button button--primary" type="submit">
            {existing ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
