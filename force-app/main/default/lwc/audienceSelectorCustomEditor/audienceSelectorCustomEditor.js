import { LightningElement, wire, track, api } from "lwc";
import getAudiences from "@salesforce/apex/AudienceContextController.getAudienceRules";

// Constants
const DEBOUNCE_DELAY = 100;
const BLUR_DELAY = 200;
const KEY_CODES = { ENTER: 13, ESCAPE: 27, ARROW_UP: 38, ARROW_DOWN: 40 };
const DROPDOWN_LENGTH_CLASS = "slds-dropdown_length-7";

const NONE_OPTION = "--NONE--";

export default class AudienceSelectorCustomEditor extends LightningElement {
  @api label = "Select Audience";
  @api placeholderText = "Search or select an Audience...";

  @track searchTerm = "";
  // Options structure: { audienceId: string, audienceRule: string, domId: string }
  @track options = [];
  // Filtered options structure: { audienceId: string, audienceRule: string, domId: string, highlighted: boolean, isSelected: boolean }
  @track filteredOptions = [];
  // Selected audience structure: { audienceId: string, audienceRule: string }
  @track selectedAudience = null;
  @track showDropdown = false;
  @track isLoading = true;
  @track _internalDropdownPosition = "bottom";
  @track highlightedIndex = -1;

  _isDataLoaded = false;
  _initialValueSet = false;
  // _currentValue now stores the selected audienceId
  _currentValue = null;
  _debounceTimeout;
  _blurTimeout;
  _isDropdownClicked = false;

  // --- Property Editor Specific API ---
  @api
  get value() {
    // get audioenceId here
    // console.debug( `-->>> AudienceSelectorCustomEditor::get value() ${this._currentValue}`);
    return this._currentValue;
  }
  set value(val) {
    // set audienceId here
    // console.debug( `--->>> AudienceSelectorCustomEditor::set value(${val}) incoming`);
    if (this._currentValue !== val) {
      this._currentValue = val; // Store the incoming audienceId
      this._initialValueSet = true;
      if (this._isDataLoaded) {
        // console.debug( `--->>> AudienceSelectorCustomEditor::set value() data loaded, preselecting based on ${this._currentValue}`);
        this.preselectOptionFromValue(this._currentValue);
      } else {
        // console.debug( `--->>> AudienceSelectorCustomEditor::set value() data NOT loaded, value set to ${this._currentValue}`);
      }
    }
  }

  // --- Lifecycle Hooks & Data Fetching ---
  connectedCallback() {
    this.resetState();
  }

  @wire(getAudiences)
  wiredAudiences({ error, data }) {
    // console.debug('--->>> Wired Audiences: Data Received:', data);
    // console.debug('--->>> Wired Audiences: Error Received:', error);
    this.isLoading = true;
    if (data) {
      if (
        Array.isArray(data) &&
        data.length > 0 &&
        data[0].hasOwnProperty("audienceId") &&
        data[0].hasOwnProperty("audienceRule")
      ) {
        const ids = data.map((item) => item.audienceId);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
          console.warn(
            "AudienceSelectorCustomEditor: Duplicate audienceId values found in the data. Selection might be unpredictable."
          );
        }

        this.options = this.processAudienceData(data);
        this._isDataLoaded = true;
        this.error = undefined;
        // console.debug('--->>> Wired Audiences: Processed Options:', JSON.parse(JSON.stringify(this.options)));

        if (this._initialValueSet) {
          // console.debug(`--->>> Wired Audiences: Initial value (${this._currentValue}) was set, attempting preselection.`);
          this.preselectOptionFromValue(this._currentValue);
        } else {
          // console.debug('--->>> Wired Audiences: No initial value set, filtering all options.');
          this.filterOptions();
        }
      } else if (Array.isArray(data)) {
        this.options = [];
        this.filteredOptions = [];
        this._isDataLoaded = true;
        this.error = undefined;
      } else {
        console.error(
          "AudienceSelectorCustomEditor: Received data is not in the expected format (Array of {audienceId, audienceRule}).",
          data
        );
        this.options = [];
        this.filteredOptions = [];
        this._isDataLoaded = true;
        this.error = "Received invalid audience data format.";
      }
    } else if (error) {
      this.error = error;
      this.options = [];
      this.filteredOptions = [];
      this._isDataLoaded = true;
      console.error("Error loading audiences:", error);
    }
    this.isLoading = false;
  }

  get comboboxClass() {
    return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${
      this.showDropdown ? "slds-is-open" : ""
    }`;
  }

  get dropdownClass() {
    return `slds-dropdown ${DROPDOWN_LENGTH_CLASS} slds-dropdown_fluid slds-dropdown_${this._internalDropdownPosition}`;
  }

  get hasFilteredOptions() {
    return this.filteredOptions && this.filteredOptions.length > 0;
  }

  get displayValue() {
    return this.selectedAudience
      ? this.selectedAudience.audienceId
      : this.searchTerm;
  }

  get highlightedOptionId() {
    return this.highlightedIndex >= 0 &&
      this.highlightedIndex < this.filteredOptions.length
      ? this.filteredOptions[this.highlightedIndex].domId
      : null;
  }

  handleInputChange(event) {
    const newSearchTerm = event.target.value;

    if (
      this.searchTerm !== "" &&
      newSearchTerm === "" &&
      this.selectedAudience
    ) {
      this.clearSelection();
    } else {
      this.searchTerm = newSearchTerm;
      if (this.selectedAudience) {
        this.selectedAudience = null;
        // The value in _currentValue remains until a new selection or clear/blur event
      }
    }

    clearTimeout(this._debounceTimeout);
    this.isLoading = true;
    this._debounceTimeout = setTimeout(() => {
      this.filterOptions();
      this.highlightedIndex = -1;
      this.isLoading = false;
      if (!this.showDropdown && this.searchTerm) {
        this.openDropdown();
      } else if (this.showDropdown) {
        this.updateDropdownPosition();
      }
    }, DEBOUNCE_DELAY);
  }

  handleFocus() {
    clearTimeout(this._blurTimeout);
    if (!this.showDropdown && !this.isLoading) {
      this.filterOptions();
      this.openDropdown();
    }
  }

  handleBlur() {
    if (this._isDropdownClicked) return;

    this._blurTimeout = setTimeout(() => {
      if (this._isDropdownClicked) return;

      this.closeDropdown();

      if (!this.selectedAudience && this.searchTerm.trim() === "") {
        this.selectedAudience = {
          audienceId: NONE_OPTION,
          audienceRule: NONE_OPTION,
        };

        if (this._currentValue !== null) {
          // console.debug('--->>> Blur: Clearing value because input empty, no selection.');
          this.dispatchValueChange(null);
        }
      } else if (!this.selectedAudience && this.searchTerm.trim() !== "") {
        // console.debug(`--->>> Blur: Reverting search term '${this.searchTerm}' as no selection was made.`);
        this.searchTerm = ""; // Clear the invalid search term
      } else if (this.selectedAudience) {
        this.searchTerm = "";
      }
    }, BLUR_DELAY);
  }

  handleDropdownMouseDown() {
    this._isDropdownClicked = true;
  }

  handleDropdownMouseUp() {
    this._isDropdownClicked = false;
    // setTimeout(() => {
    //     const inputElement = this.template.querySelector('lightning-input');
    //     if(inputElement) inputElement.focus();
    // }, 0);
  }

  handleSelect(event) {
    const selectedDomId = event.currentTarget.dataset.domid;
    console.debug(
      `--->>> handleSelect: Clicked on audienceId: ${selectedDomId}`
    );
    if (!selectedDomId) return;
    const selectedOption = this.options.find(
      (option) => option.domId === selectedDomId
    );
    this.selectAudienceByKey(selectedOption.audienceId);
    this.closeDropdown();
  }

  handleKeyDown(event) {
    if (this.isLoading || !this._isDataLoaded) {
      event.preventDefault();
      return;
    }

    const isInputEvent = event.target?.tagName === "LIGHTNING-INPUT";

    if (!this.showDropdown) {
      // Only allow opening the dropdown via ArrowDown if the event is from the input
      if (
        event.keyCode === KEY_CODES.ARROW_DOWN &&
        this.hasFilteredOptions &&
        isInputEvent
      ) {
        event.preventDefault();
        this.openDropdown();
        this.updateHighlight(0); // Highlight first item
      }
      return;
    }

    // Handle keys when dropdown is open (this logic is fine for both input and listbox div)
    switch (event.keyCode) {
      case KEY_CODES.ARROW_DOWN:
        event.preventDefault();
        this.updateHighlight(this.highlightedIndex + 1);
        break;
      case KEY_CODES.ARROW_UP:
        event.preventDefault();
        this.updateHighlight(this.highlightedIndex - 1);
        break;
      case KEY_CODES.ENTER:
        event.preventDefault();
        if (
          this.highlightedIndex >= 0 &&
          this.highlightedIndex < this.filteredOptions.length
        ) {
          const selectedOption = this.filteredOptions[this.highlightedIndex];
          this.selectAudienceByKey(selectedOption.audienceId);
          this.closeDropdown();
        } else {
          this.closeDropdown();
        }
        break;
      case KEY_CODES.ESCAPE:
        event.preventDefault();
        if (this.selectedAudience) {
          this.searchTerm = "";
        }
        this.closeDropdown();
        break;
      default:
        if (!isInputEvent) {
          // lightning-input
          event.preventDefault(); // Prevent typing in listbox div
        }
    }
  }

  selectAudienceByKey(audienceId) {
    if (!this._isDataLoaded || !this.options) return;

    const foundOption = this.options.find(
      (option) => option.audienceId === audienceId
    );
    if (foundOption) {
      // console.debug(`--->>> selectAudienceByKey: Found option for ${audienceId}`, foundOption);
      this.selectedAudience = {
        audienceId: foundOption.audienceId,
        audienceRule: foundOption.audienceRule,
      };
      this.searchTerm = "";
      this.dispatchValueChange(this.selectedAudience.audienceId);
      this.filterOptions();
      this.highlightedIndex = -1;
    } else {
      console.warn(
        `AudienceSelectorCustomEditor: Attempted to select audienceId "${audienceId}" but not found.`
      );
    }
  }

  clearSelection() {
    // console.debug('--->>> clearSelection: Clearing selection and value.');
    this.selectedAudience = null;
    this.searchTerm = "";
    this.dispatchValueChange(null); // Notify CPE of cleared value (null audienceId)
    this.filterOptions();
    this.highlightedIndex = -1;
  }

  preselectOptionFromValue(audienceIdValue) {
    if (!this._isDataLoaded || !this.options) {
      // console.debug(`--->>> preselectOptionFromValue: Cannot preselect, data not loaded or no options. Value: ${audienceIdValue}`);
      return;
    }

    // console.debug(`--->>> preselectOptionFromValue: Attempting to preselect based on audienceId: ${audienceIdValue}`);

    if (!audienceIdValue) {
      this.selectedAudience = {
        audienceId: NONE_OPTION,
        audienceRule: NONE_OPTION,
      };
      if (this.selectedAudience) {
        // console.debug('--->>> preselectOptionFromValue: Incoming value is null/empty, clearing existing selection.');
        this.filterOptions();
      } else {
        // console.debug('--->>> preselectOptionFromValue: Incoming value is null/empty, no existing selection to clear.');
      }
      return;
    }

    const foundOption = this.options.find(
      (option) => option.audienceId === audienceIdValue
    );
    if (foundOption) {
      if (
        !this.selectedAudience ||
        this.selectedAudience.audienceId !== foundOption.audienceId
      ) {
        // console.debug(`--->>> preselectOptionFromValue: Found matching option for ${audienceIdValue}. Setting selectedAudience.`);
        this.selectedAudience = {
          audienceId: foundOption.audienceId,
          audienceRule: foundOption.audienceRule,
        };
        this.searchTerm = "";
        this.filterOptions(); // Update filtered list (needed for displayValue and isSelected)
      } else {
        // console.debug(`--->>> preselectOptionFromValue: Option for ${audienceIdValue} is already selected. No change needed.`);
        if (this.searchTerm !== "") {
          this.searchTerm = "";
        }
        this.filterOptions();
      }
    } else {
      console.warn(
        `AudienceSelectorCustomEditor: Initial value (audienceId) "${audienceIdValue}" not found in options.`
      );
      if (this.selectedAudience) {
        // If an invalid value comes, clear the current selection
        // console.debug(`--->>> preselectOptionFromValue: Invalid audienceId ${audienceIdValue} received, clearing existing selection.`);
        this.selectedAudience = null;
        this.filterOptions();
      } else {
        // console.debug(`--->>> preselectOptionFromValue: Invalid audienceId ${audienceIdValue} received, no existing selection.`);
      }
      this._currentValue = audienceIdValue;
    }
  }

  filterOptions() {
    if (!this._isDataLoaded || !Array.isArray(this.options)) {
      this.filteredOptions = [];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    let tempOptions;

    if (!term) {
      tempOptions = [...this.options];
    } else {
      tempOptions = this.options.filter(
        (option) =>
          option.audienceId && option.audienceId.toLowerCase().includes(term)
      );
    }

    this.filteredOptions = tempOptions.map((option, index) => ({
      ...option, // audienceId, audienceRule, domId
      highlighted: index === this.highlightedIndex,
      isSelected: this.selectedAudience
        ? option.audienceId === this.selectedAudience.audienceId
        : false,
    }));
  }

  openDropdown() {
    if (this.isLoading) return;
    this.filterOptions();
    this.showDropdown = true;
    this.highlightedIndex = -1;
    this.clearHighlightClasses();

    requestAnimationFrame(() => {
      this.updateDropdownPosition();
      if (this.selectedAudience) {
        this.scrollOptionIntoView();
      }
    });
  }

  closeDropdown() {
    this.showDropdown = false;
    this.highlightedIndex = -1;
    this.clearHighlightClasses();
  }

  updateDropdownPosition() {
    const inputElement = this.template.querySelector(
      ".slds-combobox__form-element"
    );
    const dropdownElement = this.template.querySelector(".slds-dropdown");

    if (!inputElement || !dropdownElement || !this.showDropdown) return;

    try {
      const inputRect = inputElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const dropdownHeight = dropdownElement.offsetHeight;
      // console.debug(`--->>> updateDropdownPosition: Measured Dropdown Height: ${dropdownHeight}`);

      const spaceBelow = viewportHeight - inputRect.bottom;
      const spaceAbove = inputRect.top;

      const buffer = 10;
      if (
        spaceBelow < dropdownHeight + buffer &&
        spaceAbove > spaceBelow + buffer
      ) {
        // console.debug(`--->>> updateDropdownPosition: Switching to TOP. Space Below: ${spaceBelow}, Space Above: ${spaceAbove}, Height: ${dropdownHeight}`);
        this._internalDropdownPosition = "top";
      } else {
        // console.debug(`--->>> updateDropdownPosition: Setting to BOTTOM. Space Below: ${spaceBelow}, Space Above: ${spaceAbove}, Height: ${dropdownHeight}`);
        this._internalDropdownPosition = "bottom"; // Default to bottom
      }
    } catch (error) {
      console.error(
        "--->>> updateDropdownPosition: AudienceSelectorCustomEditor: Error calculating dropdown position:",
        error
      );
      this._internalDropdownPosition = "bottom"; // Fallback safely
    }
  }

  updateHighlight(newIndex) {
    const maxIndex = this.filteredOptions.length - 1;
    if (maxIndex < 0) return;

    const previousIndex = this.highlightedIndex;

    // Remove highlight from previous DOM element
    if (previousIndex >= 0 && previousIndex <= maxIndex) {
      const previousOption = this.filteredOptions[previousIndex];
      if (previousOption) {
        // Ensure previous option exists at that index
        const previousElement = this.template.querySelector(
          `li[data-domid="${previousOption.domId}"]`
        );
        if (previousElement)
          previousElement.classList.remove("keyboard-highlight");
      }
    }

    // Clamp new index (wraps around)
    if (newIndex < 0) {
      newIndex = maxIndex;
    } else if (newIndex > maxIndex) {
      newIndex = 0;
    }

    this.highlightedIndex = newIndex;

    this.filterOptions();

    // Add highlight to new DOM element
    if (this.highlightedIndex >= 0) {
      const currentOption = this.filteredOptions[this.highlightedIndex];
      if (currentOption) {
        const currentElement = this.template.querySelector(
          `li[data-domid="${currentOption.domId}"]`
        );
        if (currentElement) {
          currentElement.classList.add("keyboard-highlight");
          this.scrollOptionIntoView(currentElement);
        }
      }
    }
  }

  clearHighlightClasses() {
    this.template
      .querySelectorAll("li.slds-listbox__item.keyboard-highlight")
      .forEach((el) => el.classList.remove("keyboard-highlight"));
  }

  scrollOptionIntoView(element) {
    if (!element) {
      const targetOption = this.filteredOptions.find(
        (opt) => opt.isSelected || opt.highlighted
      );
      if (targetOption) {
        element = this.template.querySelector(
          `li[data-domid="${targetOption.domId}"]`
        );
      }
    }
    if (element) {
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  dispatchValueChange(newAudienceId) {
    if (this._currentValue !== newAudienceId) {
      if (!newAudienceId) {
        this.selectedAudience = {
          audienceId: NONE_OPTION,
          audienceRule: NONE_OPTION,
        };
      }
      // console.debug(`--->>> dispatchValueChange: Value changed from ${this._currentValue} to ${newAudienceId}. Dispatching.`);
      this._currentValue = newAudienceId || NONE_OPTION;
      this.dispatchEvent(
        new CustomEvent("valuechange", {
          bubbles: true,
          composed: true,
          detail: {
            value: newAudienceId || NONE_OPTION,
          },
        })
      );
    } else {
      // console.debug(`--->>> dispatchValueChange: Value unchanged (${newAudienceId}). Not dispatching.`);
    }
  }

  resetState() {
    this.searchTerm = "";
    if (this._isDataLoaded && Array.isArray(this.options)) {
      this.filterOptions(); // Re-filter based on potentially existing value
    } else {
      this.filteredOptions = [];
    }

    if (!this._currentValue && this.selectedAudience) {
      this.selectedAudience = null;
    } else if (
      this._currentValue &&
      !this.selectedAudience &&
      this._isDataLoaded
    ) {
      this.preselectOptionFromValue(this._currentValue);
    }
    this.showDropdown = false;
    this.highlightedIndex = -1;
  }

  processAudienceData(data) {
    if (!data) return [];

    const generateDomId = (prefix, value, index) => {
      const sanitizedValue = String(value || "").replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );
      let idBase = `${prefix}-${sanitizedValue || index}`;
      if (!/^[a-zA-Z]/.test(idBase)) {
        idBase = `opt-${idBase}`;
      }
      return idBase;
    };

    const dataWithDefaulElem = [
      { audienceId: NONE_OPTION, audienceRule: NONE_OPTION },
      ...data,
    ];

    this.selectedAudience = {
      audienceId: dataWithDefaulElem[0].audienceId,
      audienceRule: dataWithDefaulElem[0].audienceRule,
    };

    return dataWithDefaulElem.map((item, index) => ({
      id: index,  
      audienceId: item.audienceId,
      audienceRule: item.audienceRule,
      domId: generateDomId("option", item.audienceId, index),
    }));
  }
}
