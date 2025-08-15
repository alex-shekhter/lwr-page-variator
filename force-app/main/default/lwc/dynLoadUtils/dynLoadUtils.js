/**
 * Determines if we running inside Aura site, not LWR
 * 
 * @returns {boolean} if true, running in Aura site, not LWR
 */
export const isAuraCheck = () => Boolean(window[ '$A' ]);

/**
 * Determines if component running now inside Experience Buulder
 *  
 * @returns {boolean} if true, running in ExperienceBuulder
 */
export const isInBuilderCheck = () => {
  const uri = window.location.href;
  const check = uri.indexOf(".live-preview.salesforce-experience.com") > -1;
  return check;
};
