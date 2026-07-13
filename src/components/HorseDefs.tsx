// Shared gradient definitions for gradient-valued colors (sunset/galaxy/etc).
// Rendered inside each horse <svg> so url(#grad…) fills resolve.
export default function HorseDefs() {
  return (
    <defs>
      <linearGradient id="gradRainbow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ff5b5b" />
        <stop offset="0.17" stopColor="#ffb14e" />
        <stop offset="0.34" stopColor="#ffe066" />
        <stop offset="0.5" stopColor="#5bd97a" />
        <stop offset="0.67" stopColor="#5bc8e0" />
        <stop offset="0.84" stopColor="#7a5fe0" />
        <stop offset="1" stopColor="#e05be0" />
      </linearGradient>
      <linearGradient id="gradSunset" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd06b" />
        <stop offset="0.45" stopColor="#ff8a5b" />
        <stop offset="0.75" stopColor="#e0567a" />
        <stop offset="1" stopColor="#7a4fb0" />
      </linearGradient>
      <linearGradient id="gradGalaxy" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2b2e6b" />
        <stop offset="0.55" stopColor="#5b3fb0" />
        <stop offset="1" stopColor="#c85be0" />
      </linearGradient>
      <linearGradient id="gradAurora" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3ad7c0" />
        <stop offset="0.5" stopColor="#5bd97a" />
        <stop offset="1" stopColor="#7a5fe0" />
      </linearGradient>
    </defs>
  );
}
