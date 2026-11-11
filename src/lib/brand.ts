declare const brand: unique symbol;

/** A nominal type: a `T` that has passed the validation for `Name`. */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };
