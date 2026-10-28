// Inline checklist editing (server-rendered forms, no client JS needed).
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RoomNode } from "@/lib/reports";
import { addItem, addRoom, removeItem, removeRoom, renameItem, renameRoom } from "./checklist-actions";

function NameForm({ action, placeholder, defaultValue, label }: { action: (f: FormData) => Promise<void>; placeholder: string; defaultValue?: string; label: string }) {
  return (
    <form action={action} className="flex gap-2">
      <Input name="name" required maxLength={80} placeholder={placeholder} defaultValue={defaultValue} className="h-10 text-base" />
      <Button type="submit" variant="outline" className="h-10">{label}</Button>
    </form>
  );
}

export function ChecklistEditor({ tenancyId, rooms }: { tenancyId: string; rooms: RoomNode[] }) {
  return (
    <div className="space-y-4">
      {rooms.map((room) => (
        <details key={room.id} className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">{room.name} <span className="text-sm text-muted-foreground">({room.items.length} items)</span></summary>
          <div className="mt-3 space-y-3">
            <NameForm action={renameRoom.bind(null, tenancyId, room.id)} placeholder="Room name" defaultValue={room.name} label="Rename" />
            <ul className="space-y-2">
              {room.items.map((item) =>
                item.is_overview ? (
                  <li key={item.id} className="px-1 text-sm text-muted-foreground">{item.name} (always required)</li>
                ) : (
                  <li key={item.id} className="flex gap-2">
                    <div className="flex-1"><NameForm action={renameItem.bind(null, tenancyId, item.id)} placeholder="Item name" defaultValue={item.name} label="Save" /></div>
                    <form action={removeItem.bind(null, tenancyId, item.id)}>
                      <Button type="submit" variant="ghost" className="h-10 text-destructive" aria-label={`Remove ${item.name}`}>✕</Button>
                    </form>
                  </li>
                ),
              )}
            </ul>
            <NameForm action={addItem.bind(null, tenancyId, room.id)} placeholder="New item, e.g. AC remote" label="Add" />
            <form action={removeRoom.bind(null, tenancyId, room.id)}>
              <Button type="submit" variant="ghost" className="text-destructive">Remove this room</Button>
            </form>
          </div>
        </details>
      ))}
      <NameForm action={addRoom.bind(null, tenancyId)} placeholder="New room, e.g. Store room" label="Add room" />
    </div>
  );
}
