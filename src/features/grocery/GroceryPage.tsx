import {
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  History,
  ListPlus,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingBasket,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, Field, Modal, PageHeader, ProgressBar, StatusBadge } from '../../components/ui'
import {
  GROCERY_UNIT_OPTIONS,
  aggregateGroceryItems,
  canonicalizeIngredientName,
  copyHistoryEntryToList,
  defaultPantryLocation,
  groceryItemFromStaple,
  groceryMealsForWindow,
  groceryUnitFamily,
  isValidGroceryQuantity,
  purchaseQuantity,
} from '../../domain/grocery'
import type {
  GroceryCategory,
  GroceryHistoryEntry,
  GroceryItem,
  GroceryList,
  GroceryStaple,
  PantryItem,
  StorageLocation,
} from '../../domain/types'
import { formatQuantity } from '../../domain/recipe'
import { addDays, formatDate, makeId, startOfWeek, toLocalDate } from '../../utilities/date'
import '../../styles/grocery-v2.css'

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
const LOCATIONS: StorageLocation[] = ['Pantry', 'Refrigerator', 'Freezer']

type HandoffSelection = Record<string, { selected: boolean; quantity: number; location: StorageLocation }>

export default function GroceryPage() {
  const { data, updateData } = useApp()
  const [addPantryOpen, setAddPantryOpen] = useState(false)
  const [handoffMode, setHandoffMode] = useState<'choices' | 'select'>('choices')
  const [handoffSelection, setHandoffSelection] = useState<HandoffSelection>({})
  const [historyEntry, setHistoryEntry] = useState<GroceryHistoryEntry | null>(null)
  const list = data.activeGroceryList
  const categories = useMemo(() => {
    const configured = data.settings.groceryCategories
      .filter((category) => category.enabled)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => category.name)
    const itemCategories = list?.items.map((item) => item.category) ?? []
    return Array.from(new Set([...(configured.length ? configured : FALLBACK_CATEGORIES), ...itemCategories]))
  }, [data.settings.groceryCategories, list?.items])
  const checked = list?.items.filter((item) => item.checked).length ?? 0
  const total = list?.items.length ?? 0

  const generate = () => {
    const timestamp = new Date().toISOString()
    const today = toLocalDate(new Date())
    const weekEnd = toLocalDate(addDays(startOfWeek(new Date()), 6))
    const scopedMeals = groceryMealsForWindow(data.meals, today, weekEnd)
    const items = aggregateGroceryItems(
      scopedMeals,
      data.recipes,
      data.pantry,
      timestamp,
      data.settings.measurementSystem,
    )
    updateData(
      (previous) => ({
        ...previous,
        activeGroceryList: {
          id: makeId('grocery-list'),
          createdAt: timestamp,
          updatedAt: timestamp,
          source: 'generated',
          name: 'Weekly groceries',
          sourceStartDate: today,
          sourceEndDate: weekEnd,
          sourceMealIds: scopedMeals.map((meal) => meal.id),
          items,
          status: 'draft',
        },
      }),
      `Generated ${items.length} grocery requirements for ${formatDate(today)} through ${formatDate(weekEnd)}. Review pantry amounts and staple suggestions before shopping.`,
    )
  }

  const updateItem = (id: string, change: Partial<GroceryItem>, message?: string) => {
    const timestamp = new Date().toISOString()
    updateData(
      (previous) =>
        previous.activeGroceryList
          ? {
              ...previous,
              activeGroceryList: {
                ...previous.activeGroceryList,
                updatedAt: timestamp,
                items: previous.activeGroceryList.items.map((item) =>
                  item.id === id ? { ...item, ...change, updatedAt: timestamp } : item,
                ),
              },
            }
          : previous,
      message,
    )
  }

  const addStaples = (staples: GroceryStaple[]) => {
    if (!staples.length) return
    const timestamp = new Date().toISOString()
    updateData(
      (previous) =>
        previous.activeGroceryList
          ? {
              ...previous,
              activeGroceryList: {
                ...previous.activeGroceryList,
                updatedAt: timestamp,
                items: [
                  ...previous.activeGroceryList.items,
                  ...staples.map((staple) => groceryItemFromStaple(staple, timestamp)),
                ],
              },
            }
          : previous,
      `${staples.length} selected ${staples.length === 1 ? 'staple' : 'staples'} added for review.`,
    )
  }

  const startShopping = () =>
    updateData(
      (previous) =>
        previous.activeGroceryList
          ? {
              ...previous,
              activeGroceryList: {
                ...previous.activeGroceryList,
                updatedAt: new Date().toISOString(),
                status: 'shopping',
                items: previous.activeGroceryList.items
                  .filter((item) => purchaseQuantity(item) > 0)
                  .map((item) => ({
                    ...item,
                    quantity: purchaseQuantity(item),
                    pantryQuantity: 0,
                    pantryCustomQuantity: undefined,
                  })),
              },
            }
          : previous,
      'Shopping list is ready.',
    )

  const addShoppingItem = (item: GroceryItem) =>
    updateData(
      (previous) =>
        previous.activeGroceryList
          ? {
              ...previous,
              activeGroceryList: {
                ...previous.activeGroceryList,
                updatedAt: item.updatedAt,
                items: [...previous.activeGroceryList.items, item],
              },
            }
          : previous,
      `${item.name} added to the list.`,
    )

  const deleteShoppingItem = (item: GroceryItem) => {
    if (!window.confirm(`Delete “${item.name}” from this list?`)) return
    updateData(
      (previous) =>
        previous.activeGroceryList
          ? {
              ...previous,
              activeGroceryList: {
                ...previous.activeGroceryList,
                updatedAt: new Date().toISOString(),
                items: previous.activeGroceryList.items.filter((entry) => entry.id !== item.id),
              },
            }
          : previous,
      `${item.name} deleted from the list.`,
    )
  }

  const clearCompleted = () => {
    if (!list?.items.some((item) => item.checked)) return
    if (!window.confirm('Delete all checked items from this active list?')) return
    updateData(
      (previous) =>
        previous.activeGroceryList
          ? {
              ...previous,
              activeGroceryList: {
                ...previous.activeGroceryList,
                updatedAt: new Date().toISOString(),
                items: previous.activeGroceryList.items.filter((item) => !item.checked),
              },
            }
          : previous,
      'Checked items cleared.',
    )
  }

  const openHandoff = () => {
    if (!data.activeGroceryList) return
    setHandoffSelection(
      Object.fromEntries(
        data.activeGroceryList.items.map((item) => [
          item.id,
          {
            selected: item.checked,
            quantity: item.quantity,
            location: defaultPantryLocation(item.category),
          },
        ]),
      ),
    )
    setHandoffMode('choices')
    setAddPantryOpen(true)
  }

  const complete = () => {
    if (!list) return
    const timestamp = new Date().toISOString()
    const snapshot: GroceryHistoryEntry = {
      id: makeId('history'),
      createdAt: timestamp,
      updatedAt: timestamp,
      source: 'manual',
      name: list.name,
      completedAt: timestamp,
      items: structuredClone(list.items),
      sourceStartDate: list.sourceStartDate,
      sourceEndDate: list.sourceEndDate,
      sourceMealIds: list.sourceMealIds ? [...list.sourceMealIds] : undefined,
    }
    updateData(
      (previous) => ({
        ...previous,
        activeGroceryList: previous.activeGroceryList
          ? { ...previous.activeGroceryList, status: 'completed', completedAt: timestamp, updatedAt: timestamp }
          : null,
        groceryHistory: [snapshot, ...previous.groceryHistory],
      }),
      'Grocery trip completed and saved to history.',
    )
    setHandoffSelection(
      Object.fromEntries(
        list.items.map((item) => [
          item.id,
          {
            selected: item.checked,
            quantity: item.quantity,
            location: defaultPantryLocation(item.category),
          },
        ]),
      ),
    )
    setHandoffMode('choices')
    setAddPantryOpen(true)
  }

  const confirmPantryAdditions = (mode: 'purchased' | 'selected') => {
    if (!data.activeGroceryList) return
    const timestamp = new Date().toISOString()
    const additions: PantryItem[] = data.activeGroceryList.items.flatMap((item) => {
      const selection = handoffSelection[item.id]
      const selected = mode === 'purchased' ? item.checked : selection?.selected === true
      const quantity = mode === 'purchased' ? item.quantity : selection?.quantity
      if (!selected || quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) return []
      return [
        {
          id: makeId('pantry'),
          createdAt: timestamp,
          updatedAt: timestamp,
          source: 'manual' as const,
          name: item.name,
          canonicalName: item.canonicalName,
          quantity,
          unit: item.unit,
          category: item.category,
          location:
            mode === 'purchased'
              ? defaultPantryLocation(item.category)
              : (selection?.location ?? defaultPantryLocation(item.category)),
        },
      ]
    })
    updateData(
      (previous) => ({ ...previous, pantry: [...previous.pantry, ...additions], activeGroceryList: null }),
      additions.length
        ? `${additions.length} confirmed purchases added to your pantry.`
        : 'No purchases were selected; pantry was unchanged.',
    )
    setAddPantryOpen(false)
  }

  const skipPantry = () => {
    updateData((previous) => ({ ...previous, activeGroceryList: null }), 'Pantry update skipped.')
    setAddPantryOpen(false)
  }

  const copyHistory = (entry: GroceryHistoryEntry) => {
    if (data.activeGroceryList && !window.confirm('Replace the current grocery list with a new copy of this trip?'))
      return
    const next = copyHistoryEntryToList(entry)
    updateData((previous) => ({ ...previous, activeGroceryList: next }), `${entry.name} copied to a new editable list.`)
    setHistoryEntry(null)
  }

  return (
    <>
      <PageHeader
        title="Grocery"
        description="Build, review, shop, and send only confirmed purchases back to your pantry."
        action={
          !list || list.status === 'completed' ? (
            <button className="button button--primary" type="button" onClick={generate}>
              <Sparkles aria-hidden="true" /> Generate list
            </button>
          ) : undefined
        }
      />
      {!list ? (
        <Card>
          <EmptyState
            title="No active grocery list"
            detail="Plan meals first, then MyHub will combine compatible quantities and let you explicitly choose pantry amounts and staples."
            action={
              <button className="button button--primary" type="button" onClick={generate}>
                <Sparkles aria-hidden="true" /> Generate from meal plan
              </button>
            }
          />
        </Card>
      ) : null}
      {list?.status === 'draft' ? (
        <PantryCheck
          list={list}
          staples={data.settings.groceryStaples}
          updateItem={updateItem}
          addStaples={addStaples}
          startShopping={startShopping}
        />
      ) : null}
      {list?.status === 'shopping' ? (
        <ShoppingView
          list={list}
          checked={checked}
          total={total}
          categories={categories}
          updateItem={updateItem}
          addItem={addShoppingItem}
          deleteItem={deleteShoppingItem}
          clearCompleted={clearCompleted}
          complete={complete}
        />
      ) : null}
      {list?.status === 'completed' ? (
        <Card className="trip-complete">
          <span className="section-icon section-icon--mint">
            <PackageCheck aria-hidden="true" />
          </span>
          <h2>Trip completed</h2>
          <p>
            Your {list.items.length}-item list is frozen in history. Only checked items count as confirmed purchases
            unless you explicitly choose another item.
          </p>
          <button className="button button--primary" type="button" onClick={openHandoff}>
            Review pantry update
          </button>
        </Card>
      ) : null}
      <HistorySection entries={data.groceryHistory} onOpen={setHistoryEntry} />
      <HistoryModal entry={historyEntry} onClose={() => setHistoryEntry(null)} onCopy={copyHistory} />
      <PurchaseHandoffModal
        open={addPantryOpen}
        list={list}
        mode={handoffMode}
        selection={handoffSelection}
        onModeChange={setHandoffMode}
        onSelectionChange={setHandoffSelection}
        onClose={() => setAddPantryOpen(false)}
        onAddPurchased={() => confirmPantryAdditions('purchased')}
        onAddSelected={() => confirmPantryAdditions('selected')}
        onSkip={skipPantry}
      />
    </>
  )
}

function PantryCheck({
  list,
  staples,
  updateItem,
  addStaples,
  startShopping,
}: {
  list: GroceryList
  staples: GroceryStaple[]
  updateItem: (id: string, change: Partial<GroceryItem>, message?: string) => void
  addStaples: (staples: GroceryStaple[]) => void
  startShopping: () => void
}) {
  const [selectedStaples, setSelectedStaples] = useState<string[]>([])
  const enabledStaples = staples.filter((staple) => staple.enabled)
  const includedStaples = new Set(
    list.items.map((item) => `${canonicalizeIngredientName(item.canonicalName)}|${groceryUnitFamily(item.unit)}`),
  )
  const reviewed = list.items.filter((item) => item.pantryDecision !== 'unreviewed').length
  const customInvalid = list.items.some(
    (item) =>
      item.pantryDecision === 'custom' &&
      (!Number.isFinite(item.pantryCustomQuantity) || (item.pantryCustomQuantity ?? -1) < 0),
  )
  const ready = list.items.length > 0 && reviewed === list.items.length && !customInvalid

  const confirmStaples = () => {
    const choices = enabledStaples.filter(
      (staple) =>
        selectedStaples.includes(staple.id) &&
        !includedStaples.has(`${canonicalizeIngredientName(staple.canonicalName)}|${groceryUnitFamily(staple.unit)}`),
    )
    addStaples(choices)
    setSelectedStaples([])
  }

  return (
    <div className="grocery-flow">
      <Card className="flow-intro">
        <div>
          <span>Step 1 of 2</span>
          <h2>Check pantry amounts and staples.</h2>
          <p>
            Compatible measurements combine. Uncertain names or incompatible units stay separate and are flagged for
            review.
          </p>
        </div>
        <div className="flow-progress">
          <strong>
            {reviewed}/{list.items.length}
          </strong>
          <span>reviewed</span>
          <ProgressBar
            value={reviewed}
            max={list.items.length}
            label={`${reviewed} of ${list.items.length} pantry items reviewed`}
            tone="mint"
          />
        </div>
      </Card>
      {enabledStaples.length ? (
        <Card className="staple-review">
          <div className="staple-review__heading">
            <div>
              <span className="section-icon section-icon--yellow">
                <ListPlus aria-hidden="true" />
              </span>
              <div>
                <h2>Suggested staples</h2>
                <p>Enabled in Settings. Select each staple you want, then confirm. Nothing is added automatically.</p>
              </div>
            </div>
            <button
              className="button button--secondary"
              type="button"
              disabled={!selectedStaples.length}
              onClick={confirmStaples}
            >
              Add {selectedStaples.length || ''} selected
            </button>
          </div>
          <div className="staple-grid">
            {enabledStaples.map((staple) => {
              const alreadyIncluded = includedStaples.has(
                `${canonicalizeIngredientName(staple.canonicalName)}|${groceryUnitFamily(staple.unit)}`,
              )
              return (
                <label key={staple.id} className={alreadyIncluded ? 'staple-choice is-included' : 'staple-choice'}>
                  <input
                    type="checkbox"
                    checked={selectedStaples.includes(staple.id)}
                    disabled={alreadyIncluded}
                    onChange={(event) => {
                      const selected = event.currentTarget.checked
                      setSelectedStaples((current) =>
                        selected ? [...current, staple.id] : current.filter((id) => id !== staple.id),
                      )
                    }}
                  />
                  <span>
                    <strong>{staple.name}</strong>
                    <small>
                      {alreadyIncluded
                        ? 'Already on list'
                        : `${formatQuantity(staple.quantity)} ${staple.unit} · ${staple.category}`}
                    </small>
                  </span>
                </label>
              )
            })}
          </div>
        </Card>
      ) : null}
      {!list.items.length ? (
        <Card>
          <EmptyState
            title="No meal ingredients yet"
            detail={
              enabledStaples.length
                ? 'Select one or more suggested staples above, or add meals before generating again.'
                : 'Add planned recipe meals or configure enabled staples in Settings, then generate again.'
            }
          />
        </Card>
      ) : null}
      <div className="pantry-check-list">
        {list.items.map((item) => (
          <PantryCheckRow key={item.id} item={item} updateItem={updateItem} />
        ))}
      </div>
      <div className="sticky-action">
        <div>
          <strong>
            {reviewed} of {list.items.length} reviewed
          </strong>
          <span>
            {ready
              ? 'Every item has an explicit pantry choice.'
              : 'Review every item and enter any custom amount before continuing.'}
          </span>
        </div>
        <button className="button button--primary" type="button" disabled={!ready} onClick={startShopping}>
          Build shopping list <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function PantryCheckRow({
  item,
  updateItem,
}: {
  item: GroceryItem
  updateItem: (id: string, change: Partial<GroceryItem>, message?: string) => void
}) {
  const customInvalid =
    item.pantryDecision === 'custom' &&
    (!Number.isFinite(item.pantryCustomQuantity) || (item.pantryCustomQuantity ?? -1) < 0)
  const choose = (decision: GroceryItem['pantryDecision']) =>
    updateItem(
      item.id,
      {
        pantryDecision: decision,
        ...(decision === 'custom' && item.pantryCustomQuantity === undefined ? { pantryCustomQuantity: 0 } : {}),
      },
      `${item.name} pantry amount updated.`,
    )
  const options: Array<{ value: GroceryItem['pantryDecision']; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'saved', label: 'Use saved amount' },
    { value: 'enough', label: 'I have enough' },
    { value: 'custom', label: 'Enter amount' },
  ]
  return (
    <Card className="pantry-check-row">
      <div>
        <div className="badge-row">
          <StatusBadge tone="food">{item.category}</StatusBadge>
          {item.needsReview ? <StatusBadge tone="attention">Review match</StatusBadge> : null}
        </div>
        <h3>{item.name}</h3>
        <p>
          Needed:{' '}
          <strong>
            {formatQuantity(item.quantity)} {item.unit}
          </strong>{' '}
          · Saved:{' '}
          <strong>
            {formatQuantity(item.pantryQuantity)} {item.unit}
          </strong>
        </p>
        {item.reviewReason ? (
          <p className="review-note">
            <CircleAlert aria-hidden="true" />
            {item.reviewReason}
          </p>
        ) : null}
      </div>
      <fieldset>
        <legend className="sr-only">Pantry amount for {item.name}</legend>
        {options.map((option) => (
          <label key={option.value} className={item.pantryDecision === option.value ? 'is-selected' : ''}>
            <input
              type="radio"
              name={`decision-${item.id}`}
              checked={item.pantryDecision === option.value}
              onChange={() => choose(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      {item.pantryDecision === 'custom' ? (
        <label className="custom-pantry-amount">
          <span>Amount on hand ({item.unit})</span>
          <input
            aria-label={`Amount on hand for ${item.name}`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            required
            value={item.pantryCustomQuantity ?? ''}
            aria-invalid={customInvalid}
            onChange={(event) =>
              updateItem(item.id, {
                pantryCustomQuantity: event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value),
              })
            }
          />
          {customInvalid ? <small>Enter zero or a positive amount.</small> : null}
        </label>
      ) : null}
      <div className="pantry-check-row__result">
        <span>Buy</span>
        <strong>
          {formatQuantity(purchaseQuantity(item))} {item.unit}
        </strong>
      </div>
    </Card>
  )
}

function ShoppingView({
  list,
  checked,
  total,
  categories,
  updateItem,
  addItem,
  deleteItem,
  clearCompleted,
  complete,
}: {
  list: GroceryList
  checked: number
  total: number
  categories: GroceryCategory[]
  updateItem: (id: string, change: Partial<GroceryItem>, message?: string) => void
  addItem: (item: GroceryItem) => void
  deleteItem: (item: GroceryItem) => void
  clearCompleted: () => void
  complete: () => void
}) {
  const [editing, setEditing] = useState<GroceryItem | 'new' | null>(null)
  const orderedCategories = Array.from(new Set([...categories, ...list.items.map((item) => item.category)]))

  const saveItem = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const name = String(values.get('name') ?? '').trim()
    const quantity = Number(values.get('quantity'))
    const unit = String(values.get('unit') ?? '').trim()
    if (!name || !unit || !isValidGroceryQuantity(quantity)) return
    const timestamp = new Date().toISOString()
    const valuesToSave: Partial<GroceryItem> = {
      name,
      canonicalName: canonicalizeIngredientName(name),
      quantity,
      unit,
      category: String(values.get('category')),
      note: String(values.get('note') ?? '').trim() || undefined,
    }
    if (editing === 'new') {
      addItem({
        id: makeId('grocery'),
        createdAt: timestamp,
        updatedAt: timestamp,
        source: 'manual',
        checked: false,
        sourceRecipeIds: [],
        pantryQuantity: 0,
        pantryDecision: 'none',
        name,
        canonicalName: valuesToSave.canonicalName ?? canonicalizeIngredientName(name),
        quantity,
        unit,
        category: valuesToSave.category ?? 'Other',
        note: valuesToSave.note,
      })
    } else if (editing) {
      updateItem(editing.id, valuesToSave, `${name} updated.`)
    }
    setEditing(null)
  }

  return (
    <div className="shopping-layout">
      <Card className="shopping-progress">
        <div>
          <span className="section-icon section-icon--yellow">
            <ShoppingBasket aria-hidden="true" />
          </span>
          <div>
            <h2>{list.name}</h2>
            <p>
              {checked} of {total} items checked
            </p>
            {list.sourceStartDate && list.sourceEndDate ? (
              <small>
                Planned meals from {formatDate(list.sourceStartDate)} through {formatDate(list.sourceEndDate)}
              </small>
            ) : null}
          </div>
          <div className="shopping-toolbar">
            <button className="button button--secondary" type="button" onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" /> Add item
            </button>
            <button className="button button--quiet" type="button" disabled={!checked} onClick={clearCompleted}>
              Clear completed
            </button>
          </div>
        </div>
        <ProgressBar value={checked} max={total} label={`${checked} of ${total} groceries checked`} tone="yellow" />
      </Card>
      {!list.items.length ? (
        <Card>
          <EmptyState
            title="Your shopping list is empty"
            detail="Add a custom item to keep shopping, or complete the trip to preserve the empty snapshot."
            action={
              <button className="button button--primary" type="button" onClick={() => setEditing('new')}>
                Add item
              </button>
            }
          />
        </Card>
      ) : null}
      {orderedCategories.map((category) => {
        const items = list.items.filter((item) => item.category === category)
        if (!items.length) return null
        return (
          <section key={category} className="grocery-group">
            <h2>
              {category}
              <span>{items.length}</span>
            </h2>
            <div>
              {items.map((item) => (
                <article key={item.id} className={item.checked ? 'grocery-check is-checked' : 'grocery-check'}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      aria-label={`Mark ${item.name} purchased`}
                      onChange={() =>
                        updateItem(
                          item.id,
                          { checked: !item.checked },
                          `${item.name} ${item.checked ? 'unchecked' : 'checked'}.`,
                        )
                      }
                    />
                    <span className="grocery-check__box">
                      <Check aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {formatQuantity(item.quantity)} {item.unit}
                        {item.note ? ` · ${item.note}` : ''}
                      </small>
                    </span>
                  </label>
                  <div className="grocery-item-actions">
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
                      aria-label={`Delete ${item.name}`}
                      onClick={() => deleteItem(item)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
      <div className="sticky-action">
        <div>
          <strong>
            {checked} of {total} confirmed purchased
          </strong>
          <span>
            Unchecked items stay in history but will not be added to Pantry unless you explicitly select them.
          </span>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => {
            if (window.confirm('Complete this grocery trip and save an immutable copy to history?')) complete()
          }}
        >
          Complete trip
        </button>
      </div>
      <GroceryItemModal
        item={editing}
        categories={orderedCategories}
        onClose={() => setEditing(null)}
        onSave={saveItem}
      />
    </div>
  )
}

function GroceryItemModal({
  item,
  categories,
  onClose,
  onSave,
}: {
  item: GroceryItem | 'new' | null
  categories: GroceryCategory[]
  onClose: () => void
  onSave: (form: HTMLFormElement) => void
}) {
  const existing = item === 'new' || item === null ? null : item
  return (
    <Modal
      open={item !== null}
      title={existing ? `Edit ${existing.name}` : 'Add custom grocery item'}
      description="Update the quantity, unit, category, and shopping note."
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
          <input name="name" required maxLength={120} defaultValue={existing?.name ?? ''} />
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
        <Field label="Category">
          <select name="category" defaultValue={existing?.category ?? categories[0] ?? 'Other'}>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <textarea
            name="note"
            rows={3}
            maxLength={500}
            placeholder="Brand, ripeness, aisle…"
            defaultValue={existing?.note ?? ''}
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

function HistorySection({
  entries,
  onOpen,
}: {
  entries: GroceryHistoryEntry[]
  onOpen: (entry: GroceryHistoryEntry) => void
}) {
  return (
    <section className="history-section">
      <div className="section-heading section-heading--outside">
        <div>
          <span className="section-icon section-icon--lilac">
            <History aria-hidden="true" />
          </span>
          <div>
            <h2>Grocery history</h2>
            <p>Completed trips are immutable snapshots</p>
          </div>
        </div>
      </div>
      {entries.length ? (
        <div className="history-list">
          {entries.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className="card history-row"
              onClick={() => onOpen(entry)}
              aria-label={`View ${entry.name} completed ${new Date(entry.completedAt).toLocaleDateString()}`}
            >
              <div>
                <strong>
                  {new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(
                    new Date(entry.completedAt),
                  )}
                </strong>
                <span>{entry.name}</span>
              </div>
              <div>
                <strong>{entry.items.length}</strong>
                <span>items</span>
              </div>
              <StatusBadge tone="success">Completed</StatusBadge>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No completed trips"
            detail="Complete a shopping list and its exact item snapshot will appear here."
          />
        </Card>
      )}
    </section>
  )
}

function HistoryModal({
  entry,
  onClose,
  onCopy,
}: {
  entry: GroceryHistoryEntry | null
  onClose: () => void
  onCopy: (entry: GroceryHistoryEntry) => void
}) {
  return (
    <Modal
      open={entry !== null}
      title={entry?.name ?? 'Grocery history'}
      description={
        entry
          ? `Completed ${new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(entry.completedAt))}. This snapshot cannot be edited.`
          : undefined
      }
      onClose={onClose}
    >
      {entry ? (
        <div className="history-detail">
          <ul>
            {entry.items.map((item) => (
              <li key={item.id}>
                <span className={item.checked ? 'history-detail__check is-purchased' : 'history-detail__check'}>
                  <Check aria-hidden="true" />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {formatQuantity(item.quantity)} {item.unit} · {item.category}
                    {item.note ? ` · ${item.note}` : ''}
                  </small>
                </span>
              </li>
            ))}
          </ul>
          <div className="modal__actions">
            <button className="button button--quiet" type="button" onClick={onClose}>
              Close
            </button>
            <button className="button button--primary" type="button" onClick={() => onCopy(entry)}>
              <Copy aria-hidden="true" /> Copy to new list
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function PurchaseHandoffModal({
  open,
  list,
  mode,
  selection,
  onModeChange,
  onSelectionChange,
  onClose,
  onAddPurchased,
  onAddSelected,
  onSkip,
}: {
  open: boolean
  list: GroceryList | null
  mode: 'choices' | 'select'
  selection: HandoffSelection
  onModeChange: (mode: 'choices' | 'select') => void
  onSelectionChange: (selection: HandoffSelection) => void
  onClose: () => void
  onAddPurchased: () => void
  onAddSelected: () => void
  onSkip: () => void
}) {
  const selectedCount = Object.values(selection).filter((item) => item.selected && item.quantity > 0).length
  const purchasedCount = list?.items.filter((item) => item.checked).length ?? 0
  return (
    <Modal
      open={open}
      title="Add purchases to Pantry?"
      description="Only this explicit step changes inventory. Unchecked items are excluded unless you select them in the detailed flow."
      onClose={onClose}
    >
      {mode === 'choices' ? (
        <div className="choice-stack">
          <button className="choice-button" type="button" onClick={onAddPurchased}>
            <strong>Add all purchased ({purchasedCount})</strong>
            <span>
              Add every checked item with its shopping quantity and suggested location. Unchecked items remain excluded.
            </span>
          </button>
          <button className="choice-button" type="button" onClick={() => onModeChange('select')}>
            <strong>Select items</strong>
            <span>Use explicit checkboxes and customize every quantity and storage location.</span>
          </button>
          <button className="choice-button" type="button" onClick={onSkip}>
            <strong>Skip</strong>
            <span>Keep pantry inventory unchanged and close this completed trip.</span>
          </button>
        </div>
      ) : (
        <form
          className="handoff-form"
          onSubmit={(event) => {
            event.preventDefault()
            onAddSelected()
          }}
        >
          <div className="handoff-list">
            {list?.items.map((item) => {
              const current = selection[item.id] ?? {
                selected: false,
                quantity: item.quantity,
                location: defaultPantryLocation(item.category),
              }
              return (
                <fieldset key={item.id} className={current.selected ? 'handoff-row is-selected' : 'handoff-row'}>
                  <legend className="sr-only">Pantry details for {item.name}</legend>
                  <label className="handoff-row__check">
                    <input
                      type="checkbox"
                      checked={current.selected}
                      onChange={(event) => {
                        const selected = event.currentTarget.checked
                        onSelectionChange({ ...selection, [item.id]: { ...current, selected } })
                      }}
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.checked
                          ? 'Marked purchased'
                          : 'Not marked purchased — selecting is explicit confirmation'}
                      </small>
                    </span>
                  </label>
                  <label>
                    <span>Quantity ({item.unit})</span>
                    <input
                      aria-label={`Pantry quantity for ${item.name}`}
                      type="number"
                      min="0.01"
                      step="any"
                      inputMode="decimal"
                      required={current.selected}
                      disabled={!current.selected}
                      value={current.quantity}
                      onChange={(event) =>
                        onSelectionChange({
                          ...selection,
                          [item.id]: { ...current, quantity: Number(event.currentTarget.value) },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Location</span>
                    <select
                      aria-label={`Pantry location for ${item.name}`}
                      disabled={!current.selected}
                      value={current.location}
                      onChange={(event) =>
                        onSelectionChange({
                          ...selection,
                          [item.id]: { ...current, location: event.currentTarget.value as StorageLocation },
                        })
                      }
                    >
                      {LOCATIONS.map((location) => (
                        <option key={location}>{location}</option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              )
            })}
          </div>
          <div className="modal__actions">
            <button className="button button--quiet" type="button" onClick={() => onModeChange('choices')}>
              Back
            </button>
            <button className="button button--primary" type="submit">
              Add {selectedCount} selected
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
