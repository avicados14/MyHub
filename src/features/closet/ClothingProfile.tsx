import { useApp } from '../../app/AppContext'
import { Card, Field } from '../../components/ui'

export function ClothingProfile() {
  const { data, updateData } = useApp()
  const save = (field: 'clothingProfile' | 'clothingTemperatureRules', value: string) =>
    updateData(
      (previous) => ({ ...previous, settings: { ...previous.settings, [field]: value } }),
      'Clothing profile saved.',
    )
  return (
    <Card as="section" className="settings-card">
      <div className="settings-card__header" id="clothing-profile">
        <h2>Clothing profile</h2>
        <p>
          Your private clothing inventory, color notes, and layering preferences. Changes save automatically with your
          encrypted MyHub settings.
        </p>
      </div>
      <Field
        label="Clothing inventory and preferences"
        hint="Record colors, fabrics, preferred jackets, shoes, and accessories. These notes do not create photo garments or track laundry."
      >
        <textarea
          rows={14}
          maxLength={20000}
          value={data.settings.clothingProfile ?? ''}
          onChange={(event) => save('clothingProfile', event.target.value)}
        />
      </Field>
      <Field
        label="Temperature and layering rules"
        hint="Include units, feels-like versus actual temperature, range boundaries, and undershirt preferences. These are reference notes; automatic suggestions still use the garment gallery."
      >
        <textarea
          rows={10}
          maxLength={10000}
          value={data.settings.clothingTemperatureRules ?? ''}
          onChange={(event) => save('clothingTemperatureRules', event.target.value)}
        />
      </Field>
    </Card>
  )
}
