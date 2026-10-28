// Checklist templates. Every room starts with a "Room overview" item (photo always required).
export type TemplateItem = { name: string; is_overview?: boolean };
export type Template = { id: string; label: string; rooms: { name: string; items: TemplateItem[] }[] };

const room = (name: string, items: string[]) => ({
  name,
  items: [{ name: "Room overview", is_overview: true }, ...items.map((name) => ({ name }))],
});

const basics = ["Walls", "Floor", "Fan", "Lights", "Switches", "Windows", "Door"];
const pgRoom = (bed: string, cupboard: string) => [
  bed, "Mattress", "Pillow", cupboard, "Study table", "Chair", "Fan", "Tube light", "Switches",
  "Window + curtain", "Walls", "Floor", "Door + lock + key",
];
const pgBath = ["Tap", "Shower", "Geyser", "Bucket + mug", "Toilet", "Wash basin", "Mirror", "Tiles", "Exhaust fan"];
const bath = (name: string) => room(name, ["Tap", "Shower", "Geyser", "Toilet", "Wash basin", "Mirror", "Tiles", "Exhaust fan", "Door", "Lights"]);
const kitchen = room("Kitchen", ["Sink", "Tap", "Counter", "Cabinets", "Gas connection point", "Exhaust / chimney", "Tiles", ...basics]);
const oneBhk = [room("Living room", basics), room("Bedroom", basics), kitchen, bath("Bathroom"), room("Balcony", ["Floor", "Railing", "Lights", "Door"])];

export const TEMPLATES: Template[] = [
  { id: "pg-single", label: "PG single room", rooms: [room("Room", pgRoom("Bed frame", "Cupboard + key")), room("Attached bathroom", pgBath)] },
  {
    id: "pg-shared",
    label: "PG shared room",
    rooms: [room("Room", [...pgRoom("My bed", "My cupboard + key"), "Shared items: inventory note"]), room("Attached bathroom", pgBath)],
  },
  { id: "1bhk", label: "1BHK", rooms: oneBhk },
  { id: "2bhk", label: "2BHK", rooms: [...oneBhk, room("Bedroom 2", basics), bath("Bathroom 2")] },
];
