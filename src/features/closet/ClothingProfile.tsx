import { useApp } from '../../app/AppContext'
import type { ClothingTemperatureBand } from '../../domain/types'
import { validBands } from './recommendations'
import { Card, Field } from '../../components/ui'

export function ClothingProfile() {
  const { data, updateData } = useApp()
  const save = (field: 'clothingProfile' | 'clothingTemperatureRules', value: string) =>
    updateData(
      (previous) => ({ ...previous, settings: { ...previous.settings, [field]: value } }),
      'Clothing profile saved.',
    )
  const bands = data.settings.clothingTemperatureBands ?? []
  const saveBands = (next: ClothingTemperatureBand[]) =>
    updateData(
      (previous) => ({ ...previous, settings: { ...previous.settings, clothingTemperatureBands: next } }),
      'Temperature bands updated.',
    )
  const changeBand = (index: number, patch: Partial<ClothingTemperatureBand>) =>
    saveBands(bands.map((band, i) => (i === index ? { ...band, ...patch } : band)))
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
        hint="Include units, feels-like versus actual temperature, range boundaries, and undershirt preferences. These written notes are for reference. The active bands below control automatic suggestions."
      >
        <textarea
          rows={10}
          maxLength={10000}
          value={data.settings.clothingTemperatureRules ?? ''}
          onChange={(event) => save('clothingTemperatureRules', event.target.value)}
        />
      </Field>
      <h3>Active temperature bands</h3>
      <p>
        Suggestions use the planned date’s lowest feels-like temperature in °F. Each minimum is inclusive; the next
        higher minimum ends that band. Use −150 for the lowest band. All undershirts are tanks.
      </p>
      {bands.length && !validBands(bands) ? (
        <p role="alert">
          Use unique minimum temperatures from −150 to 150°F and valid clothing types. Suggestions are paused until
          these bands are valid.
        </p>
      ) : null}
      {bands.map((band, index) => (
        <fieldset key={index}>
          <legend>Temperature band {index + 1}</legend>
          <div className="form-grid">
            <Field label={`Minimum °F for band ${index + 1}`}>
              <input
                type="number"
                min={-150}
                max={150}
                value={band.minF}
                onChange={(e) => changeBand(index, { minF: Number(e.target.value) })}
              />
            </Field>
            <Field label={`Top for band ${index + 1}`}>
              <select
                value={band.top}
                onChange={(e) => changeBand(index, { top: e.target.value as ClothingTemperatureBand['top'] })}
              >
                {['short-sleeve', 'long-sleeve', 'sweatshirt'].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label={`Bottom for band ${index + 1}`}>
              <select
                value={band.bottom}
                onChange={(e) => changeBand(index, { bottom: e.target.value as ClothingTemperatureBand['bottom'] })}
              >
                <option>shorts</option>
                <option>pants</option>
              </select>
            </Field>
            <label>
              <input
                type="checkbox"
                checked={band.tank}
                onChange={(e) => changeBand(index, { tank: e.target.checked })}
              />{' '}
              Tank undershirt for band {index + 1}
            </label>
          </div>
          <button
            className="button button--quiet"
            onClick={() => {
              if (window.confirm('Remove this temperature band?')) saveBands(bands.filter((_, i) => i !== index))
            }}
          >
            Remove band {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        className="button button--secondary"
        disabled={bands.length >= 12}
        onClick={() =>
          saveBands([
            ...bands,
            {
              minF: bands.length ? Math.min(150, Math.max(...bands.map((b) => b.minF)) + 10) : -150,
              top: 'short-sleeve',
              bottom: 'shorts',
              tank: false,
            },
          ])
        }
      >
        Add temperature band
      </button>
    </Card>
  )
}
