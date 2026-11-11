import styles from './empty-state.module.css';

export function EmptyState({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return <p className={styles.empty}>{children}</p>;
}
