// ==UserScript==
// @name         speedserper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  "It’s a clean and efficient way to search, get what you need, and get on with your day."
// @author       danielsgriffin
// @match        https://www.google.com/search?*
// @match        https://www.bing.com/search?*
// @match        https://duckduckgo.com/?*
// @run-at       document-start
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @require      https://unpkg.com/@popperjs/core@2
// @require      https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/js/bootstrap.min.js
// ==/UserScript==

// Immediately hide the entire page
document.documentElement.style.display = 'none';

(function () {
    'use strict';
    let debugging = true;
    
    const serpStrategies = {
        'google': {
            searchBarAction: 'https://www.google.com/search',
            searchResultsSelector: '.MjjYud',
            sections: {
                'people-also-asked': {
                    selector: '[jsname="yEVEwb"]'},
                'related-searches': {
                    selector: '.s75CSd.u60jwe.r2fjmd.AB4Wff'
                },
            },
            findSearchResults: function () {
                return Array.from(document.querySelectorAll('h3')).map(h3 => h3.closest('a'));
            },
            extractSearchResults: function (result, originalBody) {
                if ($(result).find('div[role="heading"]').text() === 'Related searches') {
                    return { url: null, title: null, snippet: null };
                }
                if (debugging) {
                    console.log(result)
                }
                let url;
                if ($(result).is('a')) {
                    url = $(result).attr('href');
                } else {
                    url = $(result).find('a').attr('href') || '#';
                }
                let title = $(result).find('h3').text() || 'Title not found';
                function extractSnippet(result, title, originalBody) {
                    let snippetSelector = $(result).find('div.VwiC3b.yXK7lf.lyLwlc.yDYNvb.W8l4ac.lEBKkf');
                    let snippet = snippetSelector.text() || '';
                    if (!snippet) {
                        snippet = $(result).parent().parent().parent().parent().next().text();
                    }                   
                    if (debugging) {
                        console.log('Final snippet:', snippet);
                    }
                    return snippet;
                }
                let snippet = extractSnippet(result, title, originalBody);
                // Always return an object with url, title, and snippet.
                return { url, title, snippet };
            }
        },
        'duckduckgo': {
            searchBarAction: 'https://duckduckgo.com/',
            searchResultsSelector: 'ol.react-results--main li',
            sections: {
                'related-searches': {
                    selector: '.related-searches__item'
                },
            },
            extractSearchResults: function (result, originalBody) {
                let title, url, snippet;
                let layout = $(result).attr('data-layout');
                if (layout === 'organic') {
                    url = $(result).find('a[href^="http"]').attr('href') || '#';
                    title = $(result).find('h2').text() || 'Title not found';
                    snippet = $(result).find('div[data-result="snippet"]').text() || 'Snippet not found';
                }
                return { url, title, snippet };
            }
        },
        'bing': {
            searchBarAction: 'https://www.bing.com/search',
            searchResultsSelector: '.b_algo',
            sections: {
                'people-also-asked': {
                    selector: '.df_alsoAskCard',
                }
            },
            extractSearchResults: function (result, originalBody) {
                let title, url, snippet;
                let bTitleDiv = $(result).find('div.b_title');
                if (!bTitleDiv.length) {
                    bTitleDiv = $(result);
                }

                if (bTitleDiv.length) {
                    let h2Element = bTitleDiv.find('h2');
                    if (h2Element.length) {
                        let aElement = h2Element.find('a');
                        if (aElement.length) {
                            title = aElement.text();
                            url = aElement.attr('href');
                        }
                    }
                }

                if (!title) {
                    return { url, title, snippet };
                }

                function extractSnippet(result) {
                    let snippetSelector = $(result).find('div.b_caption');
                    if (snippetSelector.length) {
                        let b_paractl = snippetSelector.find('p.b_paractl');
                        snippet = b_paractl.length ? b_paractl.text() : '';

                        if (snippet.endsWith(" See more")) {
                            snippet = snippet.slice(0, -9);
                        }

                        if (!snippet) {
                            snippet = snippetSelector.text();
                        }

                        if (!snippet) {
                            let b_lineclamp3_b_algoSlug = $(result).find('p.b_lineclamp3.b_algoSlug');
                            snippet = b_lineclamp3_b_algoSlug.length ? b_lineclamp3_b_algoSlug.text() : '';
                        }
                    } else {
                        let noSnippetMarker = $('<span>').css('display', 'none').text('No snippet');
                        $(result).append(noSnippetMarker);
                    }

                    if (snippet && snippet.startsWith('Web')) {
                        snippet = snippet.replace('Web', '', 1);
                    }

                    return snippet;
                }

                snippet = extractSnippet(result);
                return { url, title, snippet };
            },

        },
    }

    function getStrategy(serpType) {
        return serpStrategies[serpType] || null;
    }

    // Utility functions
    function createMinimalSearchBar(inputValue, serpType) {
        const strategy = getStrategy(serpType);
        if (!strategy) return null;

        const searchBar = document.createElement('form');
        searchBar.action = strategy.searchBarAction;
        if (strategy.searchBarAction.includes("%s")) {
            let parts = strategy.searchBarAction.split("%s");
            searchBar.action = parts[0] + inputValue + parts[1];
        }
        searchBar.method = 'get';
        searchBar.className = 'd-flex justify-content-center'; // Use flexbox to center the form

        const inputGroupDiv = document.createElement('div');
        inputGroupDiv.className = 'input-group my-1'; // Use Bootstrap's input group for better alignment

        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'q';
        input.className = 'form-control'; // Use Bootstrap's form control for full width
        input.value = inputValue;

        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.className = 'btn btn-outline-secondary'; // Use Bootstrap's button classes
        submitButton.textContent = 'Search';

        inputGroupDiv.appendChild(input);
        inputGroupDiv.appendChild(submitButton);
        searchBar.appendChild(inputGroupDiv);

        return searchBar;
    }

    function createSerpHeader(serpType) {
        const serpHeader = document.createElement('div');
        serpHeader.className = "col-md-6 mx-auto";
        const inputValue = new URLSearchParams(window.location.search).get('q');
        const searchBar = createMinimalSearchBar(inputValue, serpType);
        if (searchBar) {
            serpHeader.appendChild(searchBar);
        }
        return serpHeader;
    }
    
    function cleanURL(url) {
        url = url.split("?")[0];
        return url
    }

    function createSearchResultsDisplay(searchResults, serpType, originalBody) {
        const strategy = getStrategy(serpType);
        if (!strategy) return null;

        const resultsDiv = document.createElement('div');
        resultsDiv.className = "col-md-9 mx-auto mt-3";

        let counter = 1; // Initialize counter for numbering
        searchResults.forEach((result) => {
            const strategy = getStrategy(serpType);
            let { url, title, snippet } = strategy.extractSearchResults(result, originalBody);
            if (!url || !title || !snippet) {
                return;
            }

            url = cleanURL(url);
            if (debugging) {
                console.log({
                    'Title': title,
                    'URL': url,
                    'Snippet': snippet
                });
            }
            
            if (snippet === "N/A" || snippet === 'Snippet not found') {
                snippet = ""
            }

            // Check if the span element exists and its textContent is not 'People also ask'
            try {
                let spanElement = result.querySelector('span');
                if (spanElement && spanElement.textContent == 'People also ask') {
                    return;
                }
            } catch (error) {
                console.log("Span element does not exist, continuing...");
            }
            
            let resultDiv = document.createElement('div'); // Create a div for each result
            resultDiv.className = "col-md-8 mx-auto"
            let numberElement = document.createElement('span');
            numberElement.textContent = counter + ".";
            numberElement.innerHTML += "&nbsp;";
            numberElement.className = "h5 m-0 p-0";
            resultDiv.id = 'result-div-' + counter;

            try {
                // Create elements for the URL, title, and snippet
                let resultDivInnerLeftMargin = "20px"
                let urlElement = document.createElement('a');
                urlElement.href = url;
                urlElement.textContent = url.split('#:~:text=')[0]; // Strip text starting with `#:~:text=`;
                urlElement.style.display = 'block'; // Display the URL on a new line
                urlElement.style.marginLeft = resultDivInnerLeftMargin;

                let titleElement = document.createElement('a');
                titleElement.href = url;

                let titleText = document.createElement('span');
                titleText.textContent = title;
                titleElement.appendChild(titleText);
                titleElement.className = "h5 m-0 p-0";
                titleElement.style.color = 'var(--bs-link-color)';
                titleElement.style.textDecoration = 'underline';
                titleElement.onmouseover = function () {
                    this.style.color = 'var(--bs-link-hover-color)';
                }
                titleElement.onmouseout = function () {
                    this.style.color = 'var(--bs-link-color)';
                }

                let titleLine = document.createElement('div');
                titleLine.className = 'd-flex flex-row'; // Change from flex-column to flex-row
                titleLine.appendChild(numberElement);
                titleLine.appendChild(titleElement);
                resultDiv.appendChild(titleLine); // Append title to resultDiv
                resultDiv.appendChild(urlElement); // Append URL to resultDiv

                let snippetElement = document.createElement('p');
                snippetElement.textContent = snippet;
                snippetElement.style.marginLeft = resultDivInnerLeftMargin;

                resultDiv.appendChild(snippetElement); // Append snippet to resultDiv
                resultsDiv.appendChild(resultDiv); // Append resultDiv to resultsDiv
                counter++; // Increment counter
            } catch (e) {
                console.error('Error processing search result:', e);
            }
        });
        return resultsDiv;
    }

    function createSection(originalBody, serpType, sectionType) {
        const strategy = getStrategy(serpType);
        if (!strategy || !strategy.sections || !strategy.sections[sectionType]) return null;

        let sectionNames = {
            "related-searches": "Related searches",
            "people-also-asked": "People also asked"
        };

        const sectionConfig = strategy.sections[sectionType];
        const sectionItems = originalBody.querySelectorAll(sectionConfig.selector);
        if (!sectionItems.length) return null;
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'd-flex col-md-8 mx-auto flex-column justify-content-center mt-3';

        const sectionButton = document.createElement('button');
        sectionButton.className = 'btn btn-small btn-primary mx-auto d-block'; // Use Bootstrap's button classes
        sectionButton.textContent = sectionNames[sectionType];
        sectionButton.setAttribute('type', 'button'); // Set the button type
        sectionButton.setAttribute('data-bs-toggle', 'tooltip'); // Set up for Bootstrap tooltip
        sectionButton.setAttribute('data-bs-placement', 'top'); // Tooltip appears on top
        sectionButton.setAttribute('title', `Toggle visibility of the '${sectionNames[sectionType]}' searches.`);
            
        const sectionItemsDisplay = document.createElement('ul');
        sectionItemsDisplay.style.display = 'none'; // Initially hide the list
        sectionItemsDisplay.className = 'col-md-8 mx-auto';

        sectionItems.forEach(item => {
            if (sectionType === 'people-also-asked') {
                let dataQValue = item.getAttribute('data-q') || item.getAttribute('data-query');
                let currentElement = item;
                // Keep checking children until 'data-q' attribute is found
                while (!dataQValue && currentElement.firstChild) {
                    currentElement = currentElement.firstChild;
                    dataQValue = currentElement.getAttribute('data-q');
                }
                const form = createMinimalSearchBar(dataQValue, serpType); // Ensure serpType is passed here
                if (form) {
                    sectionItemsDisplay.appendChild(form);
                }
            } else if (sectionType === 'related-searches') {
                let dataQValue = item.textContent;
                const form = createMinimalSearchBar(dataQValue, serpType); // Ensure serpType is passed here
                if (form) {
                    sectionItemsDisplay.appendChild(form);
                }
            }
        });

        sectionButton.onclick = () => {
            sectionButton.classList.toggle('active');
            // Update the title attribute based on whether the button is active
            // Toggle visibility of the list on button click
            sectionItemsDisplay.style.display = sectionItemsDisplay.style.display === 'none' ? '' : 'none';
            // Hide the tooltip
            var tooltipInstance = bootstrap.Tooltip.getInstance(sectionButton);
            if (tooltipInstance) {
                tooltipInstance.hide();
            }
        };

        sectionDiv.appendChild(sectionButton);
        sectionDiv.appendChild(sectionItemsDisplay);
        return sectionDiv
    }

    // Function to remove unnecessary styles
    function removeUnwantedStyles() {
        // Remove all linked stylesheets except for bootstrap.css
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            if (!link.href.includes('https://cdn.jsdelivr.net/npm/bootstrap')) {
                link.parentNode.removeChild(link);
            }
        });

        // Remove all style tags (assuming none of them are critical for Bootstrap)
        document.querySelectorAll('style').forEach(style => {
            style.parentNode.removeChild(style);
        });
    }

    // Main initialization function
    function init() {
        if (debugging) {
            $(document).ready(function () {
                let report = {
                    'jQuery version': $.fn.jquery ? $.fn.jquery : 'jQuery not loaded',
                    'Popper loaded': typeof Popper === 'object' ? 'Yes' : 'No',
                    'Bootstrap loaded': typeof $.fn.modal === 'function' ? 'Yes' : 'No'
                };
                console.log(report);
            });
        }
        setupAfterBootstrapLoad();
    }

    function setupAfterBootstrapLoad() {
        document.addEventListener("DOMContentLoaded", function () {
            removeUnwantedStyles();
            // Add the CSS
            GM_addStyle("@import url('https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css');");
            setupCustomUI();
            

            // Initialize Bootstrap tooltips
            var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        });
    }


    function setupCustomUI() {
        let searchResults = null
        let serpType = window.location.host.includes("google.") ? 'google' :
            window.location.host.includes("bing.") ? 'bing' :
                window.location.host.includes("duckduckgo.") ? 'duckduckgo' : null;

        let strategy = getStrategy(serpType);
        let originalBody;
        if (strategy) {
            let searchResultsPromise = new Promise((resolve, reject) => {
                let checkInterval = setInterval(() => {
                    originalBody = document.createElement('div');
                    originalBody.innerHTML = document.documentElement.innerHTML;
                    searchResults = originalBody.querySelectorAll(strategy.searchResultsSelector);
                    if (searchResults.length) {
                        clearInterval(checkInterval); // Stop checking
                        resolve(searchResults); // Resolve the promise
                    }
                }, 10); // Check every 10ms
            });
            searchResultsPromise.then((searchResults) => {
                // Check if there are missing search results:
                let initialSearchResultsLength = searchResults.length;
                if (initialSearchResultsLength < 10 && strategy.findSearchResults) {
                    try {
                        let additionalSearchResults = strategy.findSearchResults();
                        if (additionalSearchResults.length > initialSearchResultsLength) {
                            console.log('More search results found in the function than starting.');
                            searchResults = additionalSearchResults;
                        }
                    } catch (error) {
                        console.error('Error occurred while trying to find more search results:', error);
                    }
                }
                // Add a temporary body element
                let tempBody = document.createElement('body');

                const serpHeader = createSerpHeader(serpType, originalBody);
                if (serpHeader) {
                    tempBody.appendChild(serpHeader);
                }

                const paaDiv = createSection(originalBody, serpType, 'people-also-asked');
                if (paaDiv) {
                    tempBody.appendChild(paaDiv);
                }

                const relatedSearchesDiv = createSection(originalBody, serpType, 'related-searches');
                if (relatedSearchesDiv) {
                    tempBody.appendChild(relatedSearchesDiv);
                }


                const resultsDiv = createSearchResultsDisplay(searchResults, serpType, originalBody);
                if (resultsDiv) {
                    tempBody.appendChild(resultsDiv);
                }

                // Replace the current body with the new temporary body
                document.body = tempBody;
                document.documentElement.style.display = 'block';
            });
        } else {
            searchResults = null;
        }

    }
    
    
    init();

}) ();
