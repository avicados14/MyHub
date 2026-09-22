import { Box, CircleAlert, Plus, Refrigerator, Snowflake } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../app/AppContext'
import { Card, EmptyState, Field, Modal, PageHeader, SegmentedControl, StatusBadge } from '../../components/ui'
import type { GroceryCategory, PantryItem, StorageLocation } from '../../domain/types'
import { makeId } from '../../utilities/date'

export default function PantryPage() {
  const { data, updateData } = useApp()
  const [location, setLocation] = useState('All')
  const [open, setOpen] = useState(false)
  const items = data.pantry.filter((item) => location === 'All' || item.location === location)

  const addItem = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const timestamp = new Date().toISOString()
    const name = String(values.get('name'))
    const item: PantryItem = { id: makeId('pantry'), createdAt: timestamp, updatedAt: timestamp, source: 'manual', name, canonicalName: name.toLowerCase(), quantity: Number(values.get('quantity')), unit: String(values.get('unit')), category: String(values.get('category')) as GroceryCategory, location: String(values.get('location')) as StorageLocation, expirationDate: String(values.get('expirationDate') || '') || undefined, notes: String(values.get('notes') || '') || undefined }
    updateData((previous) => ({ ...previous, pantry: [...previous.pantry, item] }), `${name} added to ${item.location.toLowerCase()}.`)
    setOpen(false)
  }

  const locationSummary = (place: StorageLocation) => data.pantry.filter((item) => item.location === place).length

  return <>
    <PageHeader title="Pantry" description="A lightweight inventory that keeps grocery suggestions honest." action={<button className="button button--primary" type="button" onClick={() => setOpen(true)}><Plus aria-hidden="true" /> Add item</button>} />
    <div className="inventory-summary"><Card><span className="section-icon section-icon--yellow"><Box aria-hidden="true" /></span><div><span>Pantry</span><strong>{locationSummary('Pantry')}</strong><small>items</small></div></Card><Card><span className="section-icon section-icon--mint"><Refrigerator aria-hidden="true" /></span><div><span>Refrigerator</span><strong>{locationSummary('Refrigerator')}</strong><small>items</small></div></Card><Card><span className="section-icon section-icon--blue"><Snowflake aria-hidden="true" /></span><div><span>Freezer</span><strong>{locationSummary('Freezer')}</strong><small>items</small></div></Card></div>
    <div className="subnav-row"><SegmentedControl label="Pantry location" value={location} onChange={setLocation} options={['All', 'Pantry', 'Refrigerator', 'Freezer'].map((value) => ({ value, label: value }))} /></div>
    <Card className="inventory-table-card"><div className="inventory-table__header"><span>Ingredient</span><span>Amount</span><span>Location</span><span>Freshness</span><span /></div><div className="inventory-list">{items.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{item.category}</small></div><span>{item.quantity} {item.unit}</span><StatusBadge tone={item.location === 'Refrigerator' ? 'food' : item.location === 'Freezer' ? 'study' : 'attention'}>{item.location}</StatusBadge><span>{item.expirationDate ? `Use by ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${item.expirationDate}T12:00:00`))}` : 'No date set'}</span><button className="icon-button icon-button--danger" type="button" aria-label={`Remove ${item.name}`} onClick={() => { if (window.confirm(`Remove “${item.name}” from your inventory?`)) updateData((previous) => ({ ...previous, pantry: previous.pantry.filter((entry) => entry.id !== item.id) }), `${item.name} removed.`) }}>×</button></article>)}</div>{!items.length ? <EmptyState title="No items here" detail="Add what you have so MyHub can subtract it during Pantry Check." /> : null}</Card>
    <Card className="inventory-tip"><CircleAlert aria-hidden="true" /><div><strong>Inventory is only changed when you choose.</strong><p>Generating a grocery list never silently subtracts food. Purchased items are added only after you complete a trip.</p></div></Card>
    <Modal open={open} title="Add pantry item" description="Track only the amount that will be useful during Pantry Check." onClose={() => setOpen(false)}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); addItem(event.currentTarget) }}><Field label="Item name"><input name="name" required autoComplete="off" placeholder="Chicken breast…" /></Field><div className="form-grid__split"><Field label="Quantity"><input name="quantity" type="number" min="0" step="0.25" inputMode="decimal" required defaultValue="1" /></Field><Field label="Unit"><select name="unit" defaultValue="each"><option>each</option><option>oz</option><option>lb</option><option>cup</option><option>tbsp</option><option>tsp</option><option>g</option><option>kg</option><option>mL</option><option>L</option></select></Field></div><div className="form-grid__split"><Field label="Location"><select name="location" defaultValue="Pantry"><option>Pantry</option><option>Refrigerator</option><option>Freezer</option></select></Field><Field label="Category"><select name="category" defaultValue="Pantry"><option>Produce</option><option>Meat & Seafood</option><option>Dairy</option><option>Bakery</option><option>Frozen</option><option>Pantry</option><option>Snacks</option><option>Household</option><option>Other</option></select></Field></div><Field label="Expiration date (optional)"><input name="expirationDate" type="date" /></Field><Field label="Notes"><textarea name="notes" rows={2} placeholder="Opened package, top shelf…" /></Field><div className="modal__actions"><button className="button button--quiet" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button button--primary" type="submit">Add item</button></div></form></Modal>
  </>
}
