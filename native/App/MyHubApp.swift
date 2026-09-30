import SwiftUI
import UniformTypeIdentifiers
import MyHubCore

@main
struct MyHubApp: App {
    @StateObject private var model = AppModel()
    var body: some Scene { WindowGroup { RootView().environmentObject(model) } }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var backup: Backup?
    @Published var message: String?
    private let store: LocalStore
    init() {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        store = LocalStore(url: directory.appendingPathComponent("MyHub/data.json"))
        if FileManager.default.fileExists(atPath: store.url.path) {
            do { backup = try store.load() }
            catch { message = "Saved data could not be opened. It has not been replaced." }
        }
    }
    func commit(_ change: (AppData) throws -> AppData) throws {
        guard var candidate = backup else { throw SchoolError.staleDraft }
        candidate.data = try change(candidate.data)
        try store.save(candidate)
        backup = candidate
    }
    func replace(with candidate: Backup) {
        do { try store.save(candidate); backup = candidate; message = "Backup imported on this device." }
        catch { message = "The import could not be saved. Existing data has been retained." }
    }
}

enum Section: String, CaseIterable, Identifiable {
    case home = "Home", calendar = "Calendar", school = "School", food = "Food", settings = "Settings"
    var id: Self { self }
    var icon: String {
        switch self { case .home: return "house"; case .calendar: return "calendar"; case .school: return "book"; case .food: return "fork.knife"; case .settings: return "gear" }
    }
}

struct RootView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selection: Section? = .home
    var body: some View {
        if sizeClass == .regular {
            NavigationSplitView {
                List(Section.allCases, selection: $selection) { section in Label(section.rawValue, systemImage: section.icon).tag(section) }
                .navigationTitle("MyHub")
            } detail: { NavigationStack { SectionView(section: selection ?? .home) } }
        } else {
            TabView {
                ForEach(Section.allCases) { section in
                    NavigationStack { SectionView(section: section) }
                        .tabItem { Label(section.rawValue, systemImage: section.icon) }
                }
            }
        }
    }
}

struct SectionView: View {
    @EnvironmentObject private var model: AppModel
    let section: Section
    var body: some View {
        Group {
            if section == .settings { SettingsView() }
            else if section == .home, model.backup != nil { DashboardView() }
            else if section == .school, model.backup != nil { SchoolView() }
            else if section == .calendar, model.backup != nil { CalendarView() }
            else if let data = model.backup?.data {
                List {
                    switch section {
                    case .home:
                        LabeledContent("Calendar events", value: String(data.events.count))
                        LabeledContent("Homework", value: String(data.assignments.count))
                        LabeledContent("Recipes", value: String(data.recipes.count))
                        Text("Offline data stays on this device. Homework edits and study plans save locally.")
                    case .calendar: EmptyView()
                    case .school: EmptyView()
                    case .food:
                        NavigationLink("Meals and consumption") { MealConsumptionView() }
                        ForEach(data.recipes, id: \.id) { recipe in
                            NavigationLink(recipe.name) {
                                RecipeDetailView(recipe: recipe)
                            }
                        }
                    case .settings: EmptyView()
                    }
                }
            } else {
                ContentUnavailableView("No local backup", systemImage: "tray", description: Text("Import a MyHub JSON backup in Settings to start. Nothing is downloaded automatically."))
            }
        }.navigationTitle(section.rawValue)
    }
}

struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var bytes: Data
    init(bytes: Data) { self.bytes = bytes }
    init(configuration: ReadConfiguration) throws { bytes = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: bytes) }
}

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var importing = false
    @State private var exporting = false
    @State private var candidate: Backup?
    @State private var confirm = false
    @State private var document = BackupDocument(bytes: Data())
    var body: some View {
        Form {
            Text("JSON backups are plaintext and can contain private records. This build stores data only on this device.")
            Button("Import JSON backup") { importing = true }
            Button("Export JSON backup") {
                do {
                    guard let backup = model.backup else { return }
                    document = BackupDocument(bytes: try backup.encoded()); exporting = true
                } catch { model.message = "Export could not be prepared." }
            }.disabled(model.backup == nil)
            if let message = model.message { Text(message).accessibilityLabel(message) }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                candidate = try Backup.decode(Data(contentsOf: url)); confirm = true
            } catch BackupError.legacyRequiresWebMigration {
                model.message = "Import this version 1 backup into the web app and export version 2 first. Existing data was retained."
            } catch { model.message = "Unsupported or incomplete backup. Existing data was retained." }
        }
        .confirmationDialog("Replace this device’s data?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Replace local data", role: .destructive) { if let candidate { model.replace(with: candidate) }; candidate = nil }
            Button("Cancel", role: .cancel) { candidate = nil }
        } message: {
            Text("Import \(candidate?.data.events.count ?? 0) events, \(candidate?.data.assignments.count ?? 0) assignments and \(candidate?.data.recipes.count ?? 0) recipes. Export existing data first if you need to keep it.")
        }
        .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "myhub-backup") { result in
            if case .failure = result { model.message = "Export was not completed." }
        }
    }
}


struct RecipeDetailView: View {
    let recipe: Recipe
    @State private var servings: Double
    init(recipe: Recipe) {
        self.recipe = recipe
        _servings = State(initialValue: NSDecimalNumber(decimal: recipe.currentYield ?? recipe.originalYield).doubleValue)
    }
    var body: some View {
        List {
            Text(recipe.description)
            Stepper("Servings: \(Domain.formatQuantity(Decimal(servings)))", value: $servings, in: 0.5...100, step: 0.5)
            if let ingredients = try? Domain.scaledIngredients(recipe, servings: Decimal(servings)) {
                ForEach(ingredients, id: \.id) { ingredient in
                    Text("\(ingredient.quantity.map(Domain.formatQuantity) ?? "To taste") \(ingredient.unit) \(ingredient.name)")
                }
            } else { Text("This recipe needs a valid original yield before it can be scaled.") }
            ForEach(recipe.steps, id: \.id) { Text($0.text) }
            Text("Scaling is a preview. Original quantities and historical meals stay unchanged.").font(.footnote)
        }.navigationTitle(recipe.name)
    }
}

struct StudyPreviewView: View {
    @EnvironmentObject private var model: AppModel
    @State private var confirmApply = false
    let data: AppData
    @State private var startDate: String
    @State private var preview: StudyPreview?
    @State private var error: String?
    init(data: AppData) {
        self.data = data
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: data.settings.calendarTimeZone ?? "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        _startDate = State(initialValue: formatter.string(from: Date()))
    }
    var body: some View {
        Form {
            TextField("Start date (YYYY-MM-DD)", text: $startDate)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
            Button("Generate preview") {
                do { preview = try Domain.studyPreview(data, startDate: startDate); error = nil }
                catch { preview = nil; self.error = "Check the date, time zone and study settings. Nothing was saved." }
            }
            if let error { Text(error) }
            if let preview {
                LabeledContent("Unscheduled minutes", value: String(preview.unscheduledMinutes))
                ForEach(Array(preview.blocks.enumerated()), id: \.offset) { _, block in
                    VStack(alignment: .leading) {
                        Text(data.assignments.first { $0.id == block.assignmentId }?.title ?? "Homework").font(.headline)
                        Text("\(block.date) · \(block.startTime)–\(block.endTime)")
                    }
                }
                Button("Apply study plan") { confirmApply = true }
                Text("Applying replaces unprotected study blocks. Locked, completed and adjusted blocks stay unchanged.").font(.footnote)
            }
        }.navigationTitle("Study preview")
        .onChange(of: startDate) { _, _ in preview = nil }
        .confirmationDialog("Replace unprotected study blocks?", isPresented: $confirmApply, titleVisibility: .visible) {
            Button("Apply plan") {
                do {
                    guard let preview else { return }
                    try model.commit { current in
                        guard current == data else { throw SchoolError.staleDraft }
                        return try SchoolCommands.apply(preview, startDate: startDate, to: current)
                    }
                    self.preview = nil; error = "Study plan saved on this device."
                } catch { self.error = "The plan could not be saved or your data changed. Reopen this screen to preview the current data." }
            }
            Button("Cancel", role: .cancel) { }
        }
    }
}


private struct HomeworkEditorRequest: Identifiable {
    let id = UUID()
    let assignment: HomeworkAssignment?
}

struct SchoolView: View {
    @EnvironmentObject private var model: AppModel
    @State private var editor: HomeworkEditorRequest?
    @State private var showCompleted = false
    var body: some View {
        List {
            if let data = model.backup?.data {
                NavigationLink("Plan study time") { StudyPreviewView(data: data) }
                NavigationLink("Study blocks") { CalendarView(studyOnly: true) }
                NavigationLink("Study settings") { StudySettingsView(settings: data.settings.study) }
                Toggle("Show completed homework", isOn: $showCompleted)
                let visible = Domain.visibleAssignments(data)
                let tasks = showCompleted ? visible.filter { $0.status == "complete" }.sorted { $0.dueDate < $1.dueDate } : Domain.rankAssignments(visible)
                ForEach(tasks, id: \.id) { task in
                    Button { editor = HomeworkEditorRequest(assignment: task) } label: {
                        VStack(alignment: .leading) {
                            Text(task.title).font(.headline)
                            Text("\(task.course) · Due \(task.dueDate) \(task.dueTime)")
                            Text(task.status).font(.caption)
                        }.foregroundStyle(.primary)
                    }.accessibilityHint("Edit homework details and subtasks")
                }
                if tasks.isEmpty { Text(showCompleted ? "No completed homework." : "Homework is clear.") }
            }
        }
        .toolbar { Button("Add homework", systemImage: "plus") { editor = HomeworkEditorRequest(assignment: nil) } }
        .sheet(item: $editor) { request in
            NavigationStack { HomeworkEditor(assignment: request.assignment, timeZone: model.backup?.data.settings.calendarTimeZone ?? "UTC") }
        }
    }
}

struct HomeworkEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let assignment: HomeworkAssignment?
    @State private var draft: HomeworkDraft
    @State private var subtaskTitle = ""
    @State private var message: String?
    @State private var confirmDelete = false
    init(assignment: HomeworkAssignment?, timeZone: String) {
        self.assignment = assignment
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timeZone) ?? .current
        let formatter = DateFormatter()
        formatter.calendar = calendar; formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
        let due = calendar.date(byAdding: .day, value: 2, to: Date()) ?? Date()
        _draft = State(initialValue: HomeworkDraft(assignment: assignment, dueDate: formatter.string(from: due)))
    }
    var body: some View {
        Form {
            TextField("Assignment title", text: $draft.title)
            TextField("Course", text: $draft.course)
            TextField("Due date (YYYY-MM-DD)", text: $draft.dueDate).autocorrectionDisabled()
            TextField("Due time (HH:MM)", text: $draft.dueTime).autocorrectionDisabled()
            Picker("Priority", selection: $draft.priority) {
                Text("Low").tag("low"); Text("Medium").tag("medium"); Text("High").tag("high")
            }
            TextField("Estimated minutes", value: $draft.estimatedMinutes, format: .number).keyboardType(.numberPad)
            Picker("Status", selection: $draft.status) {
                Text("Not started").tag("not-started"); Text("In progress").tag("in-progress"); Text("Complete").tag("complete")
            }
            TextField("Progress percent", value: $draft.progress, format: .number).keyboardType(.numberPad)
            TextField("Notes", text: $draft.notes, axis: .vertical)
            TextField("Source label", text: $draft.sourceLabel)
            TextField("Source URL", text: $draft.sourceUrl).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
            if assignment?.source == "imported" { Text("Imported identity and provenance are retained.").font(.footnote) }
            ForEach($draft.subtasks, id: \.id) { $subtask in
                VStack {
                    TextField("Subtask title", text: $subtask.title)
                    Toggle("Completed", isOn: $subtask.completed).accessibilityLabel("Completed: \(subtask.title)")
                    Button("Remove subtask", role: .destructive) { draft.subtasks.removeAll { $0.id == subtask.id } }
                }
            }
            TextField("New subtask", text: $subtaskTitle)
            Button("Add subtask") { draft.addSubtask(title: subtaskTitle); subtaskTitle = "" }
                .disabled(subtaskTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            if assignment != nil { Button("Delete homework", role: .destructive) { confirmDelete = true } }
            if let message { Text(message) }
        }
        .navigationTitle(assignment == nil ? "Add homework" : "Edit homework")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("Save") {
                do {
                    try model.commit { try SchoolCommands.save(draft, original: assignment, in: $0) }
                    dismiss()
                } catch SchoolError.staleDraft { message = "This homework changed. Cancel and reopen it before saving." }
                catch { message = "Could not save. Check the title, course, date/time, minutes and progress. Existing data was retained." }
            } }
        }
        .confirmationDialog("Delete homework and its linked study blocks?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete homework", role: .destructive) {
                do {
                    guard let assignment else { return }
                    try model.commit { try SchoolCommands.delete(assignment, in: $0) }; dismiss()
                } catch { message = "Could not delete. Cancel and reopen the current homework before retrying." }
            }
            Button("Cancel", role: .cancel) { }
        }
    }
}


struct DashboardView: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { clock in
            if let data = model.backup?.data,
               let summary = try? Domain.dailySummary(data, now: clock.date) {
                List {
                    Text(summary.date).font(.headline)
                    SwiftUI.Section("Today's agenda") {
                        ForEach(summary.events, id: \.id) { event in
                            VStack(alignment: .leading) {
                                Text(event.title).font(.headline)
                                Text(event.allDay == true ? "All day" : "\(event.startTime)–\(event.endTime)")
                                if let end = event.endDate, end != event.date { Text("\(event.date) through \(end)").font(.caption) }
                            }
                        }
                        if summary.events.isEmpty { Text("No events today.") }
                        NavigationLink("Open calendar") { CalendarView() }
                    }
                    SwiftUI.Section("Upcoming homework") {
                        ForEach(summary.assignments, id: \.id) { task in
                            VStack(alignment: .leading) {
                                Text(task.title).font(.headline)
                                Text("Due \(task.dueDate) \(task.dueTime)")
                            }
                        }
                        if summary.assignments.isEmpty { Text("Homework is clear.") }
                        NavigationLink("Open School") { SchoolView() }
                    }
                    SwiftUI.Section("Today's meals") {
                        ForEach(summary.meals, id: \.id) { meal in
                            VStack(alignment: .leading) {
                                Text(meal.sourceSnapshot.name).font(.headline)
                                Text("\(meal.slot.capitalized): \(Domain.formatQuantity(meal.servings)) planned · \(Domain.formatQuantity(meal.preparedServings)) prepared · \(Domain.formatQuantity(meal.consumedServings)) consumed")
                            }
                        }
                        if summary.meals.isEmpty { Text("No meals planned today.") }
                    }
                    SwiftUI.Section("Consumed nutrition") {
                        metric("Calories", summary.nutrition.calories, "kcal")
                        metric("Protein", summary.nutrition.protein, "g")
                        metric("Carbohydrates", summary.nutrition.carbs, "g")
                        metric("Fat", summary.nutrition.fat, "g")
                        metric("Sugar", summary.nutrition.sugar ?? 0, "g")
                        metric("Saturated fat", summary.nutrition.saturatedFat ?? 0, "g")
                        metric("Fiber", summary.nutrition.fiber, "g")
                        metric("Sodium", summary.nutrition.sodium, "mg")
                    }
                }
            } else { Text("Check the calendar time zone in your backup.") }
        }
    }
    private func metric(_ name: String, _ value: Decimal, _ unit: String) -> some View {
        LabeledContent(name, value: "\(NSDecimalNumber(decimal: value).stringValue) \(unit)")
    }
}


private struct MealConsumptionRequest: Identifiable {
    let id = UUID()
    let meal: MealEntry
}

struct MealConsumptionView: View {
    @EnvironmentObject private var model: AppModel
    @State private var editor: MealConsumptionRequest?
    var body: some View {
        List {
            if let data = model.backup?.data {
                SwiftUI.Section("Meals") {
                    ForEach(data.meals.sorted { ($0.date, $0.slot, $0.id) < ($1.date, $1.slot, $1.id) }, id: \.id) { meal in
                        Button { editor = MealConsumptionRequest(meal: meal) } label: {
                            VStack(alignment: .leading) {
                                Text(meal.sourceSnapshot.name).font(.headline)
                                Text("\(meal.date) · \(meal.slot.capitalized)")
                                Text("\(Domain.formatQuantity(meal.servings)) planned · \(Domain.formatQuantity(meal.preparedServings)) prepared · \(Domain.formatQuantity(meal.consumedServings)) consumed")
                            }.foregroundStyle(.primary)
                        }.accessibilityHint("Edit total consumed servings")
                    }
                    if data.meals.isEmpty { Text("No imported meals yet.") }
                }
                SwiftUI.Section("Shared leftovers") {
                    ForEach(data.leftovers, id: \.id) { leftover in
                        LabeledContent(leftover.sourceSnapshot.name, value: "\(Domain.formatQuantity(FoodCommands.remaining(leftover, in: data))) servings")
                    }
                    if data.leftovers.isEmpty { Text("No leftovers.") }
                }
            }
        }.navigationTitle("Meals and consumption")
        .sheet(item: $editor) { request in NavigationStack { MealConsumptionEditor(meal: request.meal) } }
    }
}

struct MealConsumptionEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let meal: MealEntry
    @State private var servings: Decimal
    @State private var message: String?
    init(meal: MealEntry) {
        self.meal = meal; _servings = State(initialValue: meal.consumedServings)
    }
    var body: some View {
        Form {
            Text(meal.sourceSnapshot.name).font(.headline)
            Text("\(meal.date) · \(meal.slot.capitalized)")
            TextField("Total consumed servings", value: $servings, format: .number).keyboardType(.decimalPad)
            Text("This replaces the total consumed for this meal. Zero clears its nutrition log. Planned and prepared amounts stay unchanged.")
            if let message { Text(message) }
        }.navigationTitle("Record consumption")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("Save") {
                do { try model.commit { try FoodCommands.consume(meal, servings: servings, in: $0) }; dismiss() }
                catch FoodError.staleDraft { message = "This meal changed. Cancel and reopen it before saving." }
                catch { message = "Could not save. Enter a nonnegative serving amount. Existing data was retained." }
            } }
        }
    }
}
