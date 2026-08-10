/** Local, lightweight adaptation of the React Bits hyperspeed visual for transaction-pending HUDs. */
export function Hyperspeed() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-35"><div className="absolute inset-[-20%] bg-[repeating-linear-gradient(110deg,transparent_0,transparent_22px,rgba(99,230,255,.45)_23px,transparent_25px)] [animation:hyperdrive_900ms_linear_infinite]" /><style>{`@keyframes hyperdrive{to{transform:translate3d(-90px,90px,0)}}`}</style></div>;
}
