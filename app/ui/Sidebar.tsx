"use client";

type Props = {
  active: string;
  onSelect: (tab: string) => void;
};

const items = [
  { key: 'proxy', label: 'Proxy' },
  { key: 'flows', label: 'Flows' },
  { key: 'repeater', label: 'Repeater' },
  { key: 'rules', label: 'Rules' },
];

export default function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="w-44 border-r border-zinc-200/70 dark:border-zinc-800 p-2 hidden sm:flex flex-col gap-1">
      <div className="text-sm font-semibold mb-2">Menu</div>
      {items.map((i) => (
        <button
          key={i.key}
          onClick={() => onSelect(i.key)}
          className={`text-left rounded px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
            active === i.key ? 'bg-zinc-100 dark:bg-zinc-900 font-medium' : ''
          }`}
        >
          {i.label}
        </button>
      ))}
    </aside>
  );
}
