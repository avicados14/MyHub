import { Check, ChevronRight, History, PackageCheck, ShoppingBasket, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, Modal, PageHeader, ProgressBar, StatusBadge } from '../../components/ui'
import { aggregateGroceryItems, purchaseQuantity } from '../../domain/grocery'
import type { GroceryCategory, GroceryHistoryEntry, GroceryItem, PantryItem } from '../../domain/types'
import { formatQuantity } from '../../domain/recipe'
import { makeId } from '../../utilities/date'

const categoryOrder: GroceryCategory[] = ['Produce', 'Meat & Seafood', 'Dairy', 'Bakery', 'Frozen', 'Pantry', 'Snacks', 'Household', 'Other']

export default function GroceryPage() {
  const { data, updateData } = useApp()
  const [addPantryOpen, setAddPantryOpen] = useState(false)
  const list = data.activeGroceryList
  const checked = list?.items.filter((item) => item.checked).length ?? 0
  const total = list?.items.length ?? 0

  const generate = () => {
    const timestamp = new Date().toISOString()
    const items = aggregateGroceryItems(data.meals, data.recipes, data.pantry, timestamp)
    updateData((previous) => ({ ...previous, activeGroceryList: { id: makeId('grocery-list'), createdAt: timestamp, updatedAt: timestamp, source: 'generated', name: 'Weekly groceries', items, status: 'draft' } }), `Generated ${items.length} grocery requirements. Review your pantry before shopping.`)
  }

  const updateItem = (id: string, change: Partial<GroceryItem>, message?: string) => {
    updateData((previous) => previous.activeGroceryList ? ({ ...previous, activeGroceryList: { ...previous.activeGroceryList, updatedAt: new Date().toISOString(), items: previous.activeGroceryList.items.map((item) => item.id === id ? { ...item, ...change, updatedAt: new Date().toISOString() } : item) } }) : previous, message)
  }

  const startShopping = () => updateData((previous) => previous.activeGroceryList ? ({ ...previous, activeGroceryList: { ...previous.activeGroceryList, status: 'shopping', items: previous.activeGroceryList.items.filter((item) => purchaseQuantity(item) > 0).map((item) => ({ ...item, quantity: purchaseQuantity(item) })) } }) : previous, 'Shopping list is ready.')

  const complete = () => {
    if (!list) return
    const timestamp = new Date().toISOString()
    const snapshot: GroceryHistoryEntry = { id: makeId('history'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', name: list.name, completedAt: timestamp, items: structuredClone(list.items) }
    updateData((previous) => ({ ...previous, activeGroceryList: previous.activeGroceryList ? { ...previous.activeGroceryList, status: 'completed', completedAt: timestamp } : null, groceryHistory: [snapshot, ...previous.groceryHistory] }), 'Grocery trip completed and saved to history.')
    setAddPantryOpen(true)
  }

  const addPurchasesToPantry = (selectedOnly: boolean) => {
    if (!data.activeGroceryList) return
    const timestamp = new Date().toISOString()
    const selected = data.activeGroceryList.items.filter((item) => !selectedOnly || item.checked)
    const additions: PantryItem[] = selected.map((item) => ({ id: makeId('pantry'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', name: item.name, canonicalName: item.canonicalName, quantity: item.quantity, unit: item.unit, category: item.category, location: item.category === 'Frozen' ? 'Freezer' : ['Produce', 'Dairy', 'Meat & Seafood'].includes(item.category) ? 'Refrigerator' : 'Pantry' }))
    updateData((previous) => ({ ...previous, pantry: [...previous.pantry, ...additions], activeGroceryList: null }), `${additions.length} purchased items added to your pantry.`)
    setAddPantryOpen(false)
  }

  return <>
    <PageHeader title="Grocery" description="Turn planned meals into a checked, pantry-aware shopping list." action={!list || list.status === 'completed' ? <button className="button button--primary" type="button" onClick={generate}><Sparkles aria-hidden="true" /> Generate list</button> : undefined} />
    {!list ? <Card><EmptyState title="No active grocery list" detail="Plan meals first, then MyHub will combine ingredient quantities and compare them with your pantry." action={<button className="button button--primary" type="button" onClick={generate}><Sparkles aria-hidden="true" /> Generate from meal plan</button>} /></Card> : null}
    {list?.status === 'draft' ? <PantryCheck list={list} updateItem={updateItem} startShopping={startShopping} /> : null}
    {list?.status === 'shopping' ? <ShoppingView list={list} checked={checked} total={total} updateItem={updateItem} complete={complete} /> : null}
    {list?.status === 'completed' ? <Card className="trip-complete"><span className="section-icon section-icon--mint"><PackageCheck aria-hidden="true" /></span><h2>Trip completed</h2><p>Your {list.items.length}-item list is frozen in history. Decide whether to add purchases to your inventory.</p><button className="button button--primary" type="button" onClick={() => setAddPantryOpen(true)}>Review pantry update</button></Card> : null}
    <section className="history-section"><div className="section-heading section-heading--outside"><div><span className="section-icon section-icon--lilac"><History aria-hidden="true" /></span><div><h2>Grocery history</h2><p>Completed trips stay unchanged if recipes change later</p></div></div></div><div className="history-list">{data.groceryHistory.map((entry) => <Card key={entry.id} className="history-row"><div><strong>{new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' }).format(new Date(entry.completedAt))}</strong><span>{entry.name}</span></div><div><strong>{entry.items.length}</strong><span>items</span></div><StatusBadge tone="success">Completed</StatusBadge><ChevronRight aria-hidden="true" /></Card>)}</div></section>
    <Modal open={addPantryOpen} title="Add purchases to Pantry?" description="Only this explicit step changes your inventory." onClose={() => setAddPantryOpen(false)}><div className="choice-stack"><button className="choice-button" type="button" onClick={() => addPurchasesToPantry(false)}><strong>Add all</strong><span>Add every item from the completed list.</span></button><button className="choice-button" type="button" onClick={() => addPurchasesToPantry(true)}><strong>Add checked items</strong><span>Add only items marked as purchased.</span></button><button className="choice-button" type="button" onClick={() => { updateData((previous) => ({ ...previous, activeGroceryList: null }), 'Pantry update skipped.'); setAddPantryOpen(false) }}><strong>Skip</strong><span>Keep pantry inventory unchanged.</span></button></div></Modal>
  </>
}

function PantryCheck({ list, updateItem, startShopping }: { list: NonNullable<ReturnType<typeof useApp>['data']['activeGroceryList']>; updateItem: (id: string, change: Partial<GroceryItem>, message?: string) => void; startShopping: () => void }) {
  const reviewed = list.items.filter((item) => item.pantryDecision !== 'unreviewed').length
  return <div className="grocery-flow"><Card className="flow-intro"><div><span>Step 1 of 2</span><h2>Let’s check what you already have.</h2><p>MyHub found {list.items.length} ingredients across your planned meals. Confirm what your inventory can cover.</p></div><div className="flow-progress"><strong>{reviewed}/{list.items.length}</strong><span>reviewed</span><ProgressBar value={reviewed} max={list.items.length} label={`${reviewed} of ${list.items.length} pantry items reviewed`} tone="mint" /></div></Card><div className="pantry-check-list">{list.items.map((item) => <Card key={item.id} className="pantry-check-row"><div><StatusBadge tone="food">{item.category}</StatusBadge><h3>{item.name}</h3><p>Needed: <strong>{formatQuantity(item.quantity)} {item.unit}</strong> · Saved: <strong>{formatQuantity(item.pantryQuantity)} {item.unit}</strong></p></div><fieldset><legend className="sr-only">Pantry amount for {item.name}</legend>{[{ value: 'none', label: 'None' }, { value: 'saved', label: 'Use saved amount' }, { value: 'enough', label: 'I have enough' }].map((option) => <label key={option.value} className={item.pantryDecision === option.value ? 'is-selected' : ''}><input type="radio" name={`decision-${item.id}`} checked={item.pantryDecision === option.value} onChange={() => updateItem(item.id, { pantryDecision: option.value as GroceryItem['pantryDecision'] }, `${item.name} pantry amount updated.`)} /><span>{option.label}</span></label>)}</fieldset><div className="pantry-check-row__result"><span>Buy</span><strong>{formatQuantity(purchaseQuantity(item))} {item.unit}</strong></div></Card>)}</div><div className="sticky-action"><div><strong>{reviewed} of {list.items.length} reviewed</strong><span>You can start now and unreviewed items will stay in full.</span></div><button className="button button--primary" type="button" onClick={startShopping}>Build shopping list <ChevronRight aria-hidden="true" /></button></div></div>
}

function ShoppingView({ list, checked, total, updateItem, complete }: { list: NonNullable<ReturnType<typeof useApp>['data']['activeGroceryList']>; checked: number; total: number; updateItem: (id: string, change: Partial<GroceryItem>, message?: string) => void; complete: () => void }) {
  return <div className="shopping-layout"><Card className="shopping-progress"><div><span className="section-icon section-icon--yellow"><ShoppingBasket aria-hidden="true" /></span><div><h2>Weekly groceries</h2><p>{checked} of {total} items checked</p></div></div><ProgressBar value={checked} max={total} label={`${checked} of ${total} groceries checked`} tone="yellow" /></Card>{categoryOrder.map((category) => { const items = list.items.filter((item) => item.category === category); if (!items.length) return null; return <section key={category} className="grocery-group"><h2>{category}<span>{items.length}</span></h2><div>{items.map((item) => <label key={item.id} className={item.checked ? 'grocery-check is-checked' : 'grocery-check'}><input type="checkbox" checked={item.checked} onChange={() => updateItem(item.id, { checked: !item.checked }, `${item.name} ${item.checked ? 'unchecked' : 'checked'}.`)} /><span className="grocery-check__box"><Check aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{formatQuantity(item.quantity)} {item.unit}{item.note ? ` · ${item.note}` : ''}</small></span></label>)}</div></section> })}<div className="sticky-action"><div><strong>{checked} of {total} in your cart</strong><span>Completing creates a permanent trip snapshot.</span></div><button className="button button--primary" type="button" onClick={() => { if (window.confirm('Complete this grocery trip and save it to history?')) complete() }}>Complete trip</button></div></div>
}
