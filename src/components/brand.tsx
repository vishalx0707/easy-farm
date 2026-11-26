export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <a
      className={"brand " + (dark ? "brand-dark" : "")}
      href="/"
      aria-label="EasyFarm home"
    >
      <span aria-hidden="true" />
      EasyFarm
    </a>
  );
}
