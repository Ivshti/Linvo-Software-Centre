linvoapp_server.baseParameters.Installation = $.cookie("linvo_installation") || "main";

function LoadInstallations()
{
	linvoapp_server.ListInstallations({Limit:50},function(data)
	{
		if (!data.Installation)
		{
			/* What to do if there are no installations ... */
			return;
		}
		
		var installationCount = data.Installation.length || 1;
		$(".InstallationsCount").text(installationCount);
		if (installationCount > 4) $("#view-all").show().siblings().hide(); /* Select between "View all/Manage" Or "Manage installations" depending on the count */
		
		/* Bind the installations data to the parts of the software center that show installations */
		var templatesElem = $("#templates"), weldMap = {"id": "data-installation-id"};
		templatesElem.find(".installation-full").clone().appendTo($("#InstallationsFull").empty()).simpleweld(data.Installation, weldMap);
		templatesElem.find(".installation").clone().appendTo($("#Installations").empty()).simpleweld(data.Installation, weldMap);
		
		/* Add the icons now */
		$("#Installations, #InstallationsFull").children().each(function()
		{
			$(this).find(".Icon").attr("src","graphics/icons/"+$(this).find(".Type").text()+".png");
		});
		
		/* Select the used_installation */
		$("*[data-installation-id='"+linvoapp_server.baseParameters.Installation+"']").addClass("selected");
	}).Apply();
}

/* Set up the click handler ; this one must be dynamic since we might support loading more installations (than 50) in the future */
$(".installation, .select-installation").live("click", function() 
{
	var in_small_box = ($(this).parent().attr("id") == "Installations");
	var elem = in_small_box ? $(this) : $(this).closest(".installation-full");
	
	$(".installation, .installation-full").removeClass("selected");

	elem /* Except this element, we also have to put this class to it's "twin" in the InstallationsFull/Installations box  */
		.add($(in_small_box ? "#InstallationsFull" : "#Installations").children()[elem.index()])
		.addClass("selected"); 

	/* Set the installation as a baseParameter of the server and put that value in a cookie */
	$.cookie("linvo_installation", (linvoapp_server.baseParameters.Installation = elem.data("installation-id")));
	RefreshCentre({skipUserReload: true, skipCloseFancybox: true});
});
	
/* And the box button */
$(document).ready(function()
{	
	$("#installations-button").click(function()
	{
		/* Call fadeOut or fadeIn depending on the clicked class */
		$("#installations-box").stop(true,true)[($(this).hasClass("clicked") ? "fadeOut" : "fadeIn")]("slow");
		$(this).toggleClass("clicked"); /* and toogle it afterwards */
	});
});
