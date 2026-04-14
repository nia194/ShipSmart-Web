interface BookmarkIconProps {
  filled: boolean;
  justSaved: boolean;
}

export const BookmarkIcon = ({ filled, justSaved }: BookmarkIconProps) => (
  <div className="save-icon">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", top: 0, left: 0 }}>
      <path d="M5 7.8C5 6.11984 5 5.27976 5.32698 4.63803C5.6146 4.07354 6.07354 3.6146 6.63803 3.32698C7.27976 3 8.11984 3 9.8 3H14.2C15.8802 3 16.7202 3 17.362 3.32698C17.9265 3.6146 18.3854 4.07354 18.673 4.63803C19 5.27976 19 6.11984 19 7.8V21L12 17L5 21V7.8Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
      style={{
        position: "absolute", top: 0, left: 0,
        opacity: filled ? 1 : 0,
        clipPath: filled ? "inset(0 0 0 0)" : "inset(100% 0 0 0)",
        transition: justSaved ? "none" : "opacity .25s, clip-path .25s",
        animation: justSaved ? "bookmarkFill .35s cubic-bezier(.4,0,.2,1) forwards" : "none",
      }}>
      <path d="M5 7.8C5 6.11984 5 5.27976 5.32698 4.63803C5.6146 4.07354 6.07354 3.6146 6.63803 3.32698C7.27976 3 8.11984 3 9.8 3H14.2C15.8802 3 16.7202 3 17.362 3.32698C17.9265 3.6146 18.3854 4.07354 18.673 4.63803C19 5.27976 19 6.11984 19 7.8V21L12 17L5 21V7.8Z"
        fill="#111827" stroke="#111827" strokeWidth="1.8" />
    </svg>
  </div>
);
