"use client";

import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LocationInfo } from "@esli-cosmetics/types";
import { useLocations } from "~/hooks/use-locations";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";

interface LocationSelectProps {
  value?: string | undefined;
  onChange: (locationId: string | undefined, location?: LocationInfo) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  currentLocation?: LocationInfo | null | undefined;
  excludeLocationId?: string | undefined;
  allowAll?: boolean;
  /**
   * Optional prefix shown inside the trigger (e.g. "From", "To") so multiple
   * location selects can be told apart without a separate label element.
   */
  label?: string;
}

const ALL_VALUE = "__all__";

export function LocationSelect({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
  currentLocation,
  excludeLocationId,
  allowAll = false,
  label,
}: LocationSelectProps) {
  const { t } = useTranslation("common");
  const { t: tWarehouses } = useTranslation("warehouses");
  const [searchTerm, setSearchTerm] = useState("");

  // Helper function to translate location type
  const getLocationTypeLabel = useCallback(
    (locationType: string | null | undefined): string => {
      if (!locationType) {
        return "";
      }
      // Try to get translation, fallback to the value itself
      const translationKey = `locationTypes.${locationType}`;
      const translated = tWarehouses(translationKey);
      // If translation key is returned as-is, it means no translation exists
      return translated === translationKey ? locationType : translated;
    },
    [tWarehouses]
  );

  // Fetch locations
  const { data: locationsData, isLoading } = useLocations({
    page: 1,
    limit: 200,
  });

  const locations = locationsData?.locations || [];

  // Filter and map locations to options
  const locationOptions = useMemo<
    SearchableSelectOption<LocationInfo>[]
  >(() => {
    const optionsMap = new Map<string, SearchableSelectOption<LocationInfo>>();

    // Add "See All" option first if allowed
    if (allowAll) {
      optionsMap.set(ALL_VALUE, {
        value: ALL_VALUE,
        label: t("ui.locationSelect.seeAll"),
      } as SearchableSelectOption<LocationInfo>);
    }

    // Add current location if it exists and has a valid ID
    if (
      currentLocation &&
      currentLocation.id &&
      currentLocation.id !== excludeLocationId
    ) {
      const locationTypeLabel = getLocationTypeLabel(
        currentLocation.locationType
      );
      optionsMap.set(currentLocation.id, {
        value: currentLocation.id,
        label: locationTypeLabel
          ? `${currentLocation.name} - ${locationTypeLabel}`
          : currentLocation.name,
        data: currentLocation,
      });
    }

    // Add fetched locations (excluding the specified location)
    locations.forEach(location => {
      if (location?.id && location.id !== excludeLocationId) {
        const locationTypeLabel = getLocationTypeLabel(location.locationType);
        optionsMap.set(location.id, {
          value: location.id,
          label: locationTypeLabel
            ? `${location.name} - ${locationTypeLabel}`
            : location.name,
          data: location,
        });
      }
    });

    return Array.from(optionsMap.values());
  }, [
    locations,
    currentLocation,
    excludeLocationId,
    getLocationTypeLabel,
    allowAll,
    t,
  ]);

  // Client-side filtering
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return locationOptions;

    const search = searchTerm.toLowerCase();
    return locationOptions.filter(option => {
      // Always show "See All" option
      if (option.value === ALL_VALUE) {
        return true;
      }

      const location = option.data;
      return (
        location?.name?.toLowerCase().includes(search) ||
        location?.locationType?.toLowerCase().includes(search) ||
        location?.address?.toLowerCase().includes(search)
      );
    });
  }, [locationOptions, searchTerm]);

  const basePlaceholder = placeholder || t("ui.locationSelect.placeholder");
  const defaultPlaceholder = label
    ? `${label}: ${basePlaceholder}`
    : basePlaceholder;

  // Prefix the selected value shown in the trigger (not the dropdown list, which
  // uses renderOption) so multiple selects can be distinguished at a glance.
  const getTriggerLabel = useCallback(
    (option: SearchableSelectOption<LocationInfo>): string =>
      label ? `${label}: ${option.label}` : option.label,
    [label]
  );

  const handleValueChange = useCallback(
    (newValue: string | undefined) => {
      // Only update if value actually changed (prevents infinite loops)
      if (newValue === value) {
        return;
      }

      if (newValue === ALL_VALUE || !newValue) {
        if (value !== undefined) {
          onChange(undefined, undefined);
        }
      } else {
        const selectedOption = filteredOptions.find(
          opt => opt.value === newValue
        );
        onChange(newValue, selectedOption?.data);
      }
    },
    [value, filteredOptions, onChange]
  );

  // Always pass value prop to keep SearchableSelect controlled (prevents uncontrolled/controlled switching)
  // Use locationOptions instead of filteredOptions to check against all options, not just filtered ones
  // If value doesn't exist in options, don't pass value prop (SearchableSelect will use empty string internally)
  const hasValueInOptions = value
    ? locationOptions.some(opt => opt.value === value)
    : false;
  const selectValue = hasValueInOptions ? value : undefined;

  return (
    <div className={className}>
      <SearchableSelect<LocationInfo>
        options={filteredOptions}
        {...(selectValue ? { value: selectValue } : {})}
        onValueChange={handleValueChange}
        getOptionLabel={getTriggerLabel}
        placeholder={defaultPlaceholder}
        disabled={disabled}
        className="[&_button]:bg-white [&_button]:dark:bg-gray-800"
        {...(error ? { error } : {})}
        searchPlaceholder={t("ui.locationSelect.searchPlaceholder")}
        emptyMessage={
          searchTerm
            ? t("ui.locationSelect.noLocationsFound")
            : t("ui.locationSelect.noLocationsAvailable")
        }
        onSearchChange={setSearchTerm}
        isLoading={isLoading}
        loadingMessage={t("ui.locationSelect.loading")}
        renderOption={option => {
          // Special rendering for "See All" option
          if (option.value === ALL_VALUE) {
            return (
              <div className="italic text-gray-500 dark:text-gray-400">
                {option.label}
              </div>
            );
          }

          return (
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-gray-900 dark:text-white">
                {option.data?.name || option.label}
              </div>
              {(option.data?.locationType || option.data?.address) && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  {option.data?.locationType && (
                    <span className="text-xs">
                      {getLocationTypeLabel(option.data.locationType)}
                    </span>
                  )}
                  {option.data?.address && (
                    <span className="truncate text-xs">
                      • {option.data.address}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
