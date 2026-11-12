/**
 * A project page. On wide screens the project's name and navigation sit in the app
 * sidebar, under the main navigation; on narrow ones they sit above the content, with
 * the navigation pinned while scrolling.
 */
export function ProjectFrame({ side, children }: { readonly side: React.ReactNode; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      {/*
        Narrow: `contents` puts the side's children straight into the page, so the navigation
        can stay pinned. Wide: fixed over the sidebar, between the main navigation and sign-out.
      */}
      <div className="contents lg:fixed lg:top-42 lg:bottom-16 lg:left-0 lg:z-30 lg:block lg:w-64 lg:overflow-y-auto lg:border-t lg:border-side-line lg:px-3 lg:pt-4">
        {side}
      </div>
      {children}
    </>
  );
}
