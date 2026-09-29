import SwiftUI
import MyHubCore

private struct EventEditorRequest: Identifiable {
    let id = UUID()
    let event: CalendarEvent?
}

struct CalendarView: View {
    @EnvironmentObject private var model: AppModel
    var studyOnly = false
    @State private var editor: EventEditorRequest?
    @State private var message: String?
    var body: some View {
        List {
            if let data = model.backup?.data {
                let events = Domain.visibleEvents(data).filter { !studyOnly || $0.kind == "study" }
                    .sorted { ($0.date, $0.startTime, $0.id) < ($1.date, $1.startTime, $1.id) }
                ForEach(events, id: \.id) { event in
                    VStack(alignment: .leading, spacing: 10) {
                        Button { editor = EventEditorRequest(event: event) } label: {
                            VStack(alignment: .leading) {
                                Text(event.title).font(.headline)
                                Text("\(event.date) · \(event.allDay == true ? "All day" : "\(event.startTime)–\(event.endTime)")")
                                if let end = event.endDate, end != event.date { Text("Through \(end)") }
                            }.foregroundStyle(.primary)
                        }.accessibilityHint("Edit event details")
                        if event.kind == "study" {
                            Button(event.locked == true ? "Unlock study block" : "Lock study block") {
                                change { try CalendarCommands.setStudyState(event, locked: event.locked != true, in: $0) }
                            }
                            Button(event.completed == true ? "Reopen study block" : "Complete study block") {
                                change { try CalendarCommands.setStudyState(event, completed: event.completed != true, in: $0) }
                            }
                            if event.userAdjusted == true { Text("Manually adjusted; preserved on regeneration.").font(.caption) }
                        }
                    }.buttonStyle(.borderless)
                }
                if events.isEmpty { Text(studyOnly ? "No study blocks yet." : "No visible events.") }
            }
            if let message { Text(message) }
        }
        .navigationTitle(studyOnly ? "Study blocks" : "Calendar")
        .toolbar {
            if !studyOnly { Button("Add event", systemImage: "plus") { editor = EventEditorRequest(event: nil) } }
        }
        .sheet(item: $editor) { request in
            NavigationStack { EventEditor(event: request.event, timeZone: model.backup?.data.settings.calendarTimeZone ?? "UTC") }
        }
    }
    private func change(_ update: (AppData) throws -> AppData) {
        do { try model.commit(update); message = nil }
        catch { message = "Could not save this change. Reopen the current event and try again." }
    }
}

struct EventEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let event: CalendarEvent?
    @State private var draft: EventDraft
    @State private var message: String?
    @State private var confirmOverlap = false
    @State private var confirmDelete = false
    init(event: CalendarEvent?, timeZone: String) {
        self.event = event
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: timeZone) ?? .current; formatter.dateFormat = "yyyy-MM-dd"
        _draft = State(initialValue: EventDraft(event: event, date: formatter.string(from: Date())))
    }
    var body: some View {
        Form {
            TextField("Title", text: $draft.title)
            TextField("Date (YYYY-MM-DD)", text: $draft.date).autocorrectionDisabled()
                .disabled(event?.endDate != nil && event?.endDate != event?.date)
            if let end = event?.endDate, end != event?.date { Text("Imported date range ends \(end). Range changes are not supported yet.") }
            Toggle("All day", isOn: $draft.allDay)
            if !draft.allDay {
                TextField("Start time (HH:MM)", text: $draft.startTime).autocorrectionDisabled()
                TextField("End time (HH:MM)", text: $draft.endTime).autocorrectionDisabled()
            }
            TextField("Course", text: $draft.course)
            TextField("Location", text: $draft.location)
            TextField("Description", text: $draft.description, axis: .vertical)
            if event?.kind == "study" { Toggle("Locked", isOn: $draft.locked) }
            if let label = event?.sourceLabel { LabeledContent("Source", value: label) }
            if event != nil { Button("Delete event", role: .destructive) { confirmDelete = true } }
            if let message { Text(message) }
        }
        .navigationTitle(event == nil ? "Add event" : "Edit event")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("Save") { save() } }
        }
        .confirmationDialog("This overlaps another event. Save anyway?", isPresented: $confirmOverlap, titleVisibility: .visible) {
            Button("Save with overlap") { save(allowOverlap: true) }
            Button("Cancel", role: .cancel) { }
        }
        .confirmationDialog("Delete this event?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete event", role: .destructive) {
                do { guard let event else { return }; try model.commit { try CalendarCommands.delete(event, in: $0) }; dismiss() }
                catch { message = "Could not delete. Reopen the current event before retrying." }
            }
            Button("Cancel", role: .cancel) { }
        }
    }
    private func save(allowOverlap: Bool = false) {
        do { try model.commit { try CalendarCommands.save(draft, original: event, in: $0, allowOverlap: allowOverlap) }; dismiss() }
        catch CalendarEditError.overlapNeedsConfirmation { confirmOverlap = true }
        catch CalendarEditError.stale { message = "This event changed. Cancel and reopen it before saving." }
        catch { message = "Could not save. Check the title, date and time range. Existing data was retained." }
    }
}

struct StudySettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let original: StudySettings
    @State private var draft: StudySettings
    @State private var message: String?
    init(settings: StudySettings) { original = settings; _draft = State(initialValue: settings) }
    var body: some View {
        Form {
            TextField("Earliest time (HH:MM)", text: $draft.earliestTime)
            TextField("Latest time (HH:MM)", text: $draft.latestTime)
            TextField("Default block minutes", value: $draft.defaultBlockMinutes, format: .number).keyboardType(.numberPad)
            TextField("Maximum block minutes", value: $draft.maxBlockMinutes, format: .number).keyboardType(.numberPad)
            TextField("Break minutes", value: $draft.breakMinutes, format: .number).keyboardType(.numberPad)
            ForEach($draft.avoidTimes, id: \.id) { $range in
                AvoidRangeEditor(range: $range)
                Button("Remove avoid time", role: .destructive) { draft.avoidTimes.removeAll { $0.id == range.id } }
            }
            Button("Add avoid time") { draft.avoidTimes.append(CalendarCommands.newAvoidRange()) }
            Text("These rules apply to the next generated study plan. Existing blocks stay unchanged.").font(.footnote)
            if let message { Text(message) }
            Button("Save study settings") {
                do { try model.commit { try CalendarCommands.saveSettings(draft, original: original, in: $0) }; dismiss() }
                catch CalendarEditError.stale { message = "Settings changed. Reopen this screen before saving." }
                catch { message = "Check time ranges, selected weekdays and positive block lengths. Nothing was saved." }
            }
        }.navigationTitle("Study settings")
    }
}

private struct AvoidRangeEditor: View {
    @Binding var range: AvoidTimeRange
    let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    var body: some View {
        VStack(alignment: .leading) {
            TextField("Avoid time label", text: $range.label)
            TextField("Avoid start (HH:MM)", text: $range.startTime)
            TextField("Avoid end (HH:MM)", text: $range.endTime)
            ForEach(0..<7, id: \.self) { index in
                Toggle(days[index], isOn: Binding(get: { range.days.contains(Decimal(index)) }, set: { selected in
                    range.days.removeAll { $0 == Decimal(index) }
                    if selected { range.days.append(Decimal(index)); range.days.sort() }
                }))
            }
        }
    }
}
