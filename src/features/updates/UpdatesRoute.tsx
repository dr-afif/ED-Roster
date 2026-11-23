import { useMemo, useState } from 'react';
import { Check, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { useAuthBoundary } from '@/platform/auth';
import {
  Modal,
  ModuleBackBar,
  useAppUiState,
  useToast,
  type DepartmentUpdateItem,
} from '@/shared/ui';

type UpdateTag = DepartmentUpdateItem['tag'];

const TAG_BADGE_CLASSES: Record<UpdateTag, string> = {
  Roster: 'tone-am border border-[#C6D8B6]',
  Urgent: 'tone-nd border border-[#F8B9D4]',
  Policy: 'tone-pm border border-[#B8CEF2]',
  GHKA: 'tone-tl border border-[#99F6E4]',
};

export function UpdatesRoute() {
  const { user } = useAuthBoundary();
  const isOwner = user?.role === 'owner';
  const {
    updates,
    unreadUpdatesCount,
    addUpdate,
    toggleUpdateRead,
    markAllUpdatesRead,
    toggleUpdatePin,
    deleteUpdate,
  } = useAppUiState();
  const showToast = useToast();

  const [filter, setFilter] = useState<'All' | 'Unread' | UpdateTag>('All');
  const [search, setSearch] = useState('');
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newTag, setNewTag] = useState<UpdateTag>('Policy');
  const [newPin, setNewPin] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return updates
      .filter((u) => {
        if (filter === 'Unread' && !u.unread) return false;
        if (
          (filter === 'Roster' ||
            filter === 'Policy' ||
            filter === 'GHKA' ||
            filter === 'Urgent') &&
          u.tag !== filter
        ) {
          return false;
        }
        if (q && !u.title.toLowerCase().includes(q) && !u.body.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [updates, filter, search]);

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addUpdate({
      title: newTitle.trim(),
      body: newBody.trim() || 'Department notice posted by Owner.',
      tag: newTag,
      pinned: newPin,
      author: user?.displayName || 'Dr. Afif · Owner',
    });
    setNewTitle('');
    setNewBody('');
    setNewPin(false);
    setIsPostOpen(false);
    showToast('Department update published ✓');
  };

  const handleMarkAllRead = () => {
    markAllUpdatesRead();
    showToast('All updates marked as read ✓');
  };

  return (
    <div className="max-w-[960px] space-y-4">
      <ModuleBackBar title="Department Updates" />

      {/* Desktop Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
            Department Notices
          </p>
          <h1 className="sr-only lg:not-sr-only text-[26px] font-extrabold tracking-tight text-[#18181B]">
            Updates &amp; Announcements
          </h1>
          <p className="hidden lg:block mt-0.5 text-[13px] font-medium text-[#78716C]">
            Published roster notices, policy effective-date announcements, and GHKA claim updates.
          </p>
        </div>
        <div className="hidden lg:flex flex-wrap items-center gap-2">
          {unreadUpdatesCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E5E4] bg-white px-3.5 py-1.5 text-xs font-extrabold text-[#18181B] hover:bg-[#FAF8F5] cursor-pointer"
            >
              <Check className="h-3.5 w-3.5 text-[#0F766E]" />
              <span>Mark All Read</span>
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsPostOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-[#115E59] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Post Update</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Mobile Action Row */}
      {(unreadUpdatesCount > 0 || isOwner) && (
        <div className="flex lg:hidden flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
            {unreadUpdatesCount > 0 ? `${unreadUpdatesCount} Unread` : 'All caught up ✓'}
          </div>
          <div className="flex items-center gap-2">
            {unreadUpdatesCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#18181B] hover:bg-[#FAF8F5] cursor-pointer"
              >
                <Check className="h-3 w-3 text-[#0F766E]" />
                <span>Mark All Read</span>
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsPostOpen(true)}
                className="inline-flex items-center gap-1 rounded-full bg-[#0F766E] px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-[#115E59] cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Post Update</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter Pills + Search */}
      <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-3.5 sm:p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {(['All', 'Unread', 'Roster', 'Policy', 'GHKA', 'Urgent'] as const).map((f) => {
              const cnt =
                f === 'All'
                  ? updates.length
                  : f === 'Unread'
                    ? unreadUpdatesCount
                    : updates.filter((u) => u.tag === f).length;
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold border whitespace-nowrap transition cursor-pointer ${
                    active
                      ? 'bg-[#18181B] text-white border-[#18181B]'
                      : 'bg-[#FAF8F5] text-[#57534E] border-[#E7E5E4] hover:bg-[#EFECE6]'
                  }`}
                >
                  {cnt > 0 ? `${f} (${cnt})` : f}
                </button>
              );
            })}
          </div>
          <div className="relative min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#78716C]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search updates..."
              className="w-full rounded-full border-[1.5px] border-[#E7E5E4] bg-[#FAF8F5] py-1.5 pl-8 pr-3 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Updates Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-[26px] border border-[#E7E5E4] bg-white p-8 text-center text-xs font-semibold text-[#78716C]">
            No announcements match this filter.
          </div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className={`flex flex-col justify-between gap-3 rounded-[26px] border p-4 sm:p-5 shadow-[0_2px_10px_rgba(28,25,23,0.03)] ${
                u.pinned
                  ? 'md:col-span-2 border-[#99F6E4] border-l-4 border-l-[#0F766E] bg-gradient-to-br from-[#F0FDFA] to-white'
                  : u.unread
                    ? 'border-[#FED7AA] border-l-4 border-l-[#E06D53] bg-[#FFFDFB]'
                    : 'border-[#E7E5E4] border-l-4 border-l-[#D6D3D1] bg-white'
              }`}
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {u.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-0.5 text-[10px] font-extrabold text-[#0F766E]">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${TAG_BADGE_CLASSES[u.tag]}`}
                    >
                      {u.tag}
                    </span>
                    {u.unread && (
                      <span className="h-2 w-2 rounded-full bg-[#E06D53]" title="Unread" />
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-[#78716C]">{u.date}</span>
                </div>
                <h3 className="text-sm font-extrabold text-[#18181B]">{u.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#57534E]">{u.body}</p>
              </div>
              <div className="flex items-center justify-between border-t border-[#EFECE6] pt-2.5 text-[11px]">
                <span className="font-bold text-[#78716C]">{u.author}</span>
                <div className="flex items-center gap-1.5">
                  {isOwner && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          toggleUpdatePin(u.id);
                          showToast(u.pinned ? 'Update unpinned' : 'Update pinned to top ✓');
                        }}
                        className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-0.5 font-extrabold text-[#57534E] hover:bg-[#FAF8F5] cursor-pointer"
                      >
                        {u.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteUpdate(u.id);
                          showToast('Update removed');
                        }}
                        className="rounded-full border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Delete update"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleUpdateRead(u.id)}
                    className={`rounded-full px-2.5 py-0.5 font-extrabold transition cursor-pointer ${
                      u.unread
                        ? 'bg-[#18181B] text-white hover:bg-stone-800'
                        : 'border border-[#A7F3D0] bg-[#ECFDF5] text-[#0F766E]'
                    }`}
                  >
                    {u.unread ? '✓ Mark Read' : '✓ Read'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Post Update Modal */}
      <Modal
        isOpen={isPostOpen}
        onClose={() => setIsPostOpen(false)}
        title="Post Department Update"
        description="Publish an announcement to all active department staff."
        presentation="drawer"
        maxWidth="md"
      >
        <form onSubmit={handlePost} className="space-y-3">
          <div>
            <label className="block text-xs font-extrabold text-[#57534E] mb-1">Category</label>
            <select
              value={newTag}
              onChange={(e) => setNewTag(e.target.value as UpdateTag)}
              className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-2 text-sm font-semibold text-[#18181B]"
            >
              <option value="Roster">Roster</option>
              <option value="Policy">Policy</option>
              <option value="GHKA">GHKA</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-[#57534E] mb-1">Headline</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Feb 2027 Request Window Open"
              className="w-full rounded-xl border border-[#E7E5E4] bg-white px-3 py-2 text-sm font-semibold text-[#18181B]"
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-[#57534E] mb-1">Details</label>
            <textarea
              rows={3}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Message to all MOs..."
              className="w-full resize-none rounded-xl border border-[#E7E5E4] bg-white px-3 py-2 text-sm text-[#18181B]"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-[#57534E] cursor-pointer">
            <input
              type="checkbox"
              checked={newPin}
              onChange={(e) => setNewPin(e.target.checked)}
              className="accent-[#0F766E]"
            />
            Pin announcement to top
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-[#0F766E] py-2.5 text-sm font-extrabold text-white hover:bg-[#115E59] cursor-pointer"
          >
            Publish Update
          </button>
        </form>
      </Modal>
    </div>
  );
}
