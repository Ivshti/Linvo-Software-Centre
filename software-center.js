/* 
 * Version: 1.5.0
 * 
 * #> packaging: remove all the external javascript scripts from the folder, but add them on building (Makefile?); split the style into a "linvo-webapp-styles" package
 * #> re-factor and split code
 * #> on the CSS file, remove prefixed entries and use a prefix remover
 * #> on search, dynamically show/remove apps instead of reloading the whole thing
 * #> implement in LinvoAppServer.js > a timeout on every request after which a global ajax loader will be shown; + error page on server error
 * > GUI re-design
 * > ratings: http://colorpowered.com/colorrating/
 * > (!one more bug: when returning from filter searching, it must return to filter)
 * > a box to register an installation, infers type if it finds a word ("laptop", "tablet", "netbook") in the description/name
 * > login form to redirect to registration page
 * > there is still a bug with going back..if on second (or more) page, animations aren't proper; must scroll page to top before beginning second animation
 * > finish the full installation view, installation switching from there
 * > tooltips when cursor is on action icons
 * > translations
 * > apple-like toggles
 * > wait for disqus to load fully before doing a reset
 * > configuration (e.g. "show top rated", "show most used")
 * 
 * 2.0:
 * > built-in integration with GNOME shell extensions and maybe android store if I can integrate android virtual machine into Linvo; possibly include {gtk,qt}-apps, but instead of packaging all those apps, add a "Request" button; this concept shall be called "sources"
 * > "users also viewed/installed"/similar
 * > social network integration, "send to" button
 * > 100% mobile version with http://jquerymobile.com/
 * > "Statistics" page
 * > alternativeto integration?!
 * > remote desktop/control (puppet)
 * > on filtering/searching, if some apps are faded out, smoothly bring the others in their place / fancy tile effects
 * > remove all the log-in stuff specific to PHPBB, move to server
 * > dynamic category reloading (using a sidebar)
 * > search "website" in the global Linvo changelog and see what I can adapt from there
 * > an ability for every app to have a custom tile, defined by a template from a server key
 * > optimizations: use a faster binding-to-DOM method, maybe use weld.js; or server-side templating, and maybe template-based truncating of descriptions (or anything that's faster);  a good idea would be to append elements in the time between the issuing of a server request and the response (use a counter incremented aftr element binding and after request response, if ==2, do simpleweld)
 * > as soon as the software center is opened, start preloading (using OnIdle? ) the first pages of all categories
 * NOTE: use underscore if needed
 */

/* 
 * Basic skeleton definitions 
 * 
 * 
 * 
 */
apps_per_page = 8;
disqus_shortname = "linvo";
max_search_query = 100;
linvoapp_server = new LinvoAppServer("/linvoapp-server");
linvoapp_server.baseParameters.AuthKey = $.cookie("AuthKey");

filters = 
{
	installed : { filter_class: "Installed", add_class: function(app) { return app.Installed==1; }, server_query: { Installed: 1 }},
	upgrades : { filter_class: "Upgradable", add_class: function(app) { return app.Upgradable==1; },server_query: { Upgradable: 1 }}
}; 
 
var request; /* Used for keeping track of current AJAX requests (and timeouts possibly) */
var filter_rule; /* A reference to a jQuery object that describes a CSS rule to use when filtering */
var searchCache = new Object(); /* an object used to cache DOM elements created during search */
var search_lastapps = [], search_applist;

/* Define the error callback */
linvoapp_server.errorCallback = function(jqXHR, textStatus)
{
	if (textStatus == "abort") return; /* Don't show error on abort */
	$.fancybox($("#server-error").html(),
	{
				"autoDimensions"	: false,
				"width"         		: 280,
				"height"        		: 320,
				"hideOnOverlayClick" : false,
				"showCloseButton"	: false
	});
}
linvoapp_server.timeOut = 10000;

/* show a full app in a fancybox window by ID */
function ShowAppByID(id)
{	
	linvoapp_server.List({ID: id},function(data)
	{
		$.fancybox(
			GetAppElement(data.Application).append($(disqus_thread).detach()).html(),
			{
				"autoDimensions"	: false,
				"width"         		: 800,
				"height"        		: 500
			}
		);
						
		DISQUS.reset({
		  reload: true,
		  config: function () 
			  { 
				this.page.identifier = data.Application["@attributes"].id;  
				this.page.url = "http://linvo.org/#!"+data.Application["@attributes"].id;
			  }
		});
	}).Apply();
}

/* Truncate app descriptions by an DIV id in which there are .application div's (application-list) */
function TruncateAppDesc(elem)
{
	var p = this.getElementsByTagName("p")[0];
	if (p.scrollHeight > p.offsetHeight)
		$(this).find(".tripledots").show();
}

/* 
 * Functions that put data from the server into HTML format
 * and generally interfere with the interface of this web app
 * 
 * 
 * */
 
function GetAppElement(app)
{
	var app_element = $("#templates").find(".application").clone().simpleweld(app,{"id":"data-id"});

	/* Add classes that later help the filters */
	$.each(filters, function(name,filter)
	{
		if (filter.add_class(app)) 
			app_element.addClass(filter.filter_class);
	});

	app_element.find(".Icon").attr("src",(typeof(app.Icon) == "string" ? linvoapp_server.baseURL+"/"+app.Icon : "graphics/icons/NoImageAvailable.png"));
	app_element.find(".ActionDownload").attr("href",app.Download);
	
	return app_element;
}

/* 
 * Filter functions
 * 
 * "Filters" are the buttons you click in order to review
 * a specific set of apps, for example, "Installed", "Upgrades"
 * or the search bar
 * 
 */
function UpdateFilters()
{
	$.each(filters, function(key,filter)
	{
		linvoapp_server.List(
			$.extend({PlainCount: true},filter.server_query),
			function(count)
			{ 
				var button = $("#"+key+"-button")
					.setActive(!(count == 0))
					.find(".count").text(count);
			})
		.Apply();
	});
}

function IncrementFilter(filter, number)
{
	filter = $(filter);
	var filterCountElem = filter.find(".count");
	var count = parseInt(filterCountElem.text())+number;
	filterCountElem.text(count);
	filter.setActive(!(count == 0));
};
		
function UndoFilters()
{
	filter_rule.text(""); /* Remove the css rule that filters apps */
	$(".filter-added").remove();
	
	/* Delete all the keys that the filters imposed from the base server query */
	$.each(filters,function() 
	{
		$.each(this.server_query, function(keyname) { delete linvoapp_server.baseParameters[keyname]; });
	});
}

/* Search bar related functions
 * 
 *  
 * 
 **/
function SearchBarReset()
{	
	$("#search-bar-input").val("").trigger("blur"); /* reset the search bar and trigger a blur in order to bring back the default text; EDIT: don't b(link)lur!! */
	$("#search-bar-reset, #search-results").hide();
}	

/* 
 * Switch between the 2 views: applications and main
 * 
 * 
 * 
 * */
function SwitchToAppView()
{		
	$("#categories").stop(true, true).hide("slow","swing",null);
	$("#back-button").stop(true, true).fadeIn("slow");
}

function SwitchToMainView()
{
	if (request) request.abort();

	$("#categories").stop(true, true).show("slow","swing"); /* handler func: undo the filter buttons' operation */
	$("#back-button").stop(true, true).fadeOut("slow");
	
	$(".applications-list").hide();
	
	SearchBarReset();
		
	/* Undo the applied filters, reset search and category, update the filter buttons and unclick them */
	UndoFilters();
	LoadAppsResetFilter();
	LoadAppsResetSearch();
	LoadAppsResetCategory();
	UpdateFilters();
	$(".filter-button").removeClass("clicked"); /* ensure this is always unclicked on the main section */
}


/* Refresh the software centre
 * 
 * Also called on first load
 * 
 * */
function RefreshCentre()
{
	linvoapp_server.StopAll(); /* Make sure all requests are stopped */
	
	$(".applications-list:not(.searched-apps)").remove(); /* Clean all the application pages, except the one for searches, it stays forever */

	$.fancybox.close();
	SwitchToMainView();
	
	/* Load categories */
	linvoapp_server.Categories({},function(data)
	{ 
		var categoriesElem = $("#categories");
		categoriesElem.empty(); /* Empty the categories element and add one instance of the template */
		$("#templates").find(".category").clone().appendTo("#categories").simpleweld(data.Category); /* Simpleweld the category array to it */
		
		categoriesElem.children().each(function()
		{ 
			$(this).find("img").attr("src","graphics/icons/"+$(this).find(".Name").text()+".png");  /* Set icons */
			$(this).setActive($(this).find(".ItemCount").text() != 0); /* Deactivate if item count is 0 */
		});
	}).Apply();
	
	/* Add top rated and newest 
	 * Newest: "List","SortBy=DateCreated","Order=Descending","Limit=3"
	 * must: $("#newest, #most-used, #top-rated").empty()
	 * */

	/* Reload user info
	 * */
	if (arguments[0] && arguments[0].skipUserReload)
		return;
		
	linvoapp_server.UserInfo({},function(data)
	{
		if (data.ID)
		{
			LoadInstallations();
			$("#profile-box").simpleweld(data);
			
			$(".hide-on-login").hide();
			$(".show-on-login").show();
		}
		else
		{
			$(".show-on-login").hide().removeClass("clicked"); /* In case an element was clicked before, on the previous logged-in session */
			$(".hide-on-login").show();
		}
	}).Apply();
}

$(document).ready(function() 
{ 
	filter_rule = $("<style>").appendTo("head");
	
	RefreshCentre();
		
	/* Interface stuff 
	 * */
	$(".category").live("click",function()
	{
		if ($(this).hasClass("inactive")) return;
		SwitchToAppView();
		LoadApps($(this).find(".Name").text(),0);
	});
	 	
	$("button, input:submit").button(); //style all the buttons and submit inputs using jquery UI
	$(".fancyboxed").fancybox();
	
	/* Load disqus 
	 * */
	disqus_thread = $.create("div",{id: "disqus_thread"});
	$("#fancybox-content").append(disqus_thread);
	$.getScript("http://" + disqus_shortname + ".disqus.com/embed.js");

	/* Displays a full app in fancybox */
	$(".application").live("click", function(e) 	/* use live handling; for obvious reasons */
	{ 
		/* Make sure we do not respond to clicking actions */
		if ($(e.target).parent().hasClass("Action"))
			return;
			
		ShowAppByID($(this).data("id")); 
	});

	/* Actions */
	$(".ActionAdd").live("click",function()
	{
		var app = $(this).closest(".application");
		
		app.addClass("Installed");
		IncrementFilter("#installed-button", 1);
		
		linvoapp_server.Add({ID: app.data("id")}).Apply();
	});

	$(".ActionRemove").live("click",function()
	{
		var app = $(this).closest(".application");
		
		IncrementFilter("#installed-button", -1);
		if (app.hasClass("Upgradable")) /* Also decrement the "Upgrades" button if it was in upgrades */
			IncrementFilter("#upgrades-button", -1);
		app.removeClass("Installed").removeClass("Upgradable");
		
		linvoapp_server.Remove({ID: app.data("id")}).Apply();
	});
	
	$(".ActionUpgrade").live("click",function()
	{
		var app = $(this).closest(".application");

		app.removeClass("Upgradable");
		IncrementFilter("#upgrades-button", -1);
		
		linvoapp_server
			.Remove({ID: app.find(".Name").text()+" "+app.find(".InstalledVersion").text()})
			.Add({ID: app.data("id")})
			.Apply();
	});
				
	/* Search bar 
	 * SearchBarEmpty: a function that is called when the search bar is empty/has to be emptied; deals with server queries and everything
	 * SearchBarReset (upper in the code) : simply resets the text box
	 * LoadAppsResetSearch (upper in the code): deals only with server queries
	 * */
	function SearchBarEmpty()
	{	
		search_lastapps = [];
		search_applist.hide();
		
		if (linvoapp_server.baseParameters.Category)
		{
			SearchBarReset();
			
			/* been to a category page before searching; in which case display all the loaded pages that were shown (meaning all until LoadAppsByCategory.page) */
			$("div[id^='"+linvoapp_server.baseParameters.Category+"']").not(".searched-apps").slice(0,LoadAppsByCategory.page).show(); 
			LoadAppsResetSearch();
		}
		else
			SwitchToMainView(); /* been to main view before */
	}
	
	$("#search-bar-input").bind("input", function() 
	{
		var search_for = $(this).val();
		 
		if (search_for)
		{
			$("#search-bar-reset").show(); /* This is hidden when we SwitchToMainView */
			SwitchToAppView();
			$(".applications-list").not(".searched-apps").hide();
			LoadApps("search:"+search_for);
		}
		else 
			SearchBarEmpty();
	});
	
	$("#search-bar-reset").click(SearchBarEmpty);
	
	/* Filter magic 
	 * */
	$(".filter-button").click(function() 
	{  	
		var name = $(this).attr("id").split("-")[0];
		
		/* if we were in an applications page, browsing a category; ToggleMainSections.at won't work because we need to know if a category is loaded */
		var already_browsing_apps = linvoapp_server.baseParameters.Category || linvoapp_server.baseParameters.SearchBy;
		
		var was_clicked =  $(this).hasClass("clicked");
		$(this).toggleClass("clicked"); /* Must toggle that now because we may need that information later */
		
		if (was_clicked)
		{
			/* Undoing filter */
			LoadAppsResetFilter();
			
			if (already_browsing_apps)
				UndoFilters();
			else
				SwitchToMainView();
		}
		else
		{
			/* Doing filter */
			$(".filter-button").not(this).removeClass("clicked"); /* Unclick the button of all other filters */
			UndoFilters(); /* And undo the previous filters */
			
			if (!already_browsing_apps)
				SwitchToAppView();
				
			filter_rule.text(".application:not(."+filters[name].filter_class+") {display: none;}"); /* Set a rule to apply to shown apps */	
			LoadApps(name); /* Load more apps, filtered */
		}
	});

	/* Finally, after everything has been loaded, check for permalink requests 
	 * */
	var permalink_request = document.location.href.split("#")[1];
	if (permalink_request)
	{
		permalink_request = unescape(permalink_request);
		ShowAppByID(permalink_request);
	}
});

$(window).scroll(function()
{
	if  ($(window).scrollTop() == $(document).height() - $(window).height())
	{
		LoadApps();
	}
});
