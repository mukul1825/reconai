import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const STORAGE_KEY = "reconai_current_batch";

/**
 * The URL's ?batch= param is the source of truth when present (makes a
 * dashboard link shareable/bookmarkable), but the sidebar nav links don't
 * carry it - without this, clicking "Exceptions" after landing on the
 * dashboard from an upload would silently lose which batch you were
 * looking at. localStorage is the fallback so sidebar navigation keeps
 * the batch you're actually working on.
 */
export function useCurrentBatch() {
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get("batch");
  const [batchId, setBatchId] = useState(fromUrl || localStorage.getItem(STORAGE_KEY));

  useEffect(() => {
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      setBatchId(fromUrl);
    }
  }, [fromUrl]);

  return batchId;
}

export function setCurrentBatch(batchId) {
  localStorage.setItem(STORAGE_KEY, batchId);
}
