let client;
let agents = [];
let iparams = {
  domain: "",
  api_key: "",
  credentials: {},
  agent_ids: [],
  ticketFields: [],
};
document.onreadystatechange = async () => {
  if (document.readyState === "complete") {
    client = await app.initialized();
    $("#validate-btn").on("click", handleValidation);
    $("#ticket-fields").on("fwChange", handleTicketFields);
    $("#toggle").on("fwChange", handleToggleChange);
  }
};

const showNotification = (type, content) => {
  if (!document.getElementById("type_toast")) {
    const popup = document.createElement("fw-toast");
    popup.setAttribute("id", "type_toast");

    document.body.append(popup);
  }

  document.querySelector("#type_toast").trigger({ type, content });
};

const handleValidation = async () => {
  let domain = $("input[name='domain']").val();
  let api_key = $("input[name='api_key']").val();
  let validateBtn = document.getElementById("validate-btn");
  if (!domain || domain.trim() === "" || !api_key || api_key.trim() === "") {
    showNotification(
      "error",
      "Domain and API Key are required cannot be empty."
    );
    return false;
  }
  try {
    validateBtn.disabled = true;
    validateBtn.loading = true;
    if (/^https/.test(domain.trim())) {
      domain = domain.substring(8);
    } else domain = domain.trim();
    window.isValid = await getAgents(domain, api_key);
    await getTicketFields();
    if (window.isValid) {
      showNotification(
        "success",
        "Successfully verified Freshdesk credentials."
      );
      $("#admin-api-container").hide();
      $("#agent-api-container").show();
      $("#spinner").hide();
      iparams["domain"] = domain;
      iparams["api_key"] = api_key;
      createDDLForAgents();
    }
  } catch (error) {
    console.error(error);
  } finally {
    validateBtn.disabled = false;
    validateBtn.loading = false;
  }
};

const validateFdCredentials = async (domain, api_key) => {
  try {
    const { response, status } = await client.request.invokeTemplate(
      "validateFd",
      {
        context: {
          domain: domain,
          api_key: api_key,
        },
      }
    );
    console.log(JSON.parse(response));

    if (status === 200) {
      showNotification("success", "Credentials are validated successfully.");
      return true;
    }
  } catch (error) {
    console.error(error);
    showNotification("error", "Invalid Domain or API Key.");
    return false;
  }
};

const getAgents = async (domain, api_key, page = 1) => {
  try {
    const { response, status, headers } = await client.request.invokeTemplate(
      "getAgentsListForSettings",
      {
        context: {
          domain: domain,
          api_key: api_key,
          page,
        },
      }
    );
    agents = [...agents, ...JSON.parse(response)];
    if (status === 200) {
      if (headers.link && agents.length) {
        await getAgents(domain, api_key, ++page);
      } else return true;
    }
    return false;
  } catch (error) {
    console.error(error);
    showNotification("error", "Invalid Domain or API Key.");
    return false;
  }
};

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const wrapper = document.getElementById("wrapper");

function createDDLForAgents(id) {
  const rowId = generateId();
  const row = document.createElement("div");
  row.className = "fw-flex fw-p-8 fw-gap-4 row-enter";
  row.id = `row-${rowId}`;
  console.log(rowId);

  row.innerHTML = `
      <div style="width: 110px;">
        <fw-pill id="verified-${rowId}" color=${id ? "green" : "red"}>
       <fw-icon  name=${
         id ? "circle-check" : "circle-cross"
       } slot="icon" ></fw-icon>
      ${id ? "Verified" : "Not Verified"}  
      </fw-pill>
      </div>
      <div class="fw-flex-grow">
        <fw-select id="${`agent-list-${rowId}`}" placeholder="Please select the agent"></fw-select>
      </div>
      <div class="fw-flex-grow">
        <fw-input id="${`input-${rowId}`}" placeholder="Enter API key"></fw-input>
      </div>
      <div class="fw-flex-grow-0">
        <fw-button id="${`btn-${rowId}`}" color="secondary">
        <fw-icon slot="before-label" size="16" name="circle-check"></fw-icon>
        <span>Verify</span></fw-button>
      </div>
      <div>
        <fw-popover same-width="false">
          <fw-button slot="popover-trigger" size="icon" color="secondary">
            <fw-icon name="more-vertical" size="18" color="#264966"></fw-icon>
          </fw-button>

          <fw-list-options variant="icon" id="${`list-options-${rowId}`}" slot="popover-content"></fw-list-options>
        </fw-popover>
      </div>
  `;

  wrapper.appendChild(row);
  const select = document.getElementById(`agent-list-${rowId}`);
  select.options = agents.map((agent) => ({
    text: agent.contact.name,
    value: agent.id,
    subText: agent.contact.email,
  }));

  const popoverActions = [
    { text: "Add New", value: "add", graphicsProps: { name: "add-contact" } },
    { text: "Delete", value: "delete", graphicsProps: { name: "delete" } },
  ];

  const listOptions = document.getElementById(`list-options-${rowId}`);
  listOptions.options = popoverActions;

  listOptions.addEventListener("fwChange", (e) =>
    handleOptionChange(e.target.value, rowId)
  );

  const button = document.getElementById(`btn-${rowId}`);
  button.addEventListener("click", () => {
    handleVerifyBtn(rowId);
  });
  select.addEventListener("fwChange", (e) => handleAgentChange(e));
  if (id) {
    select.value = id;
    document.getElementById(`input-${rowId}`).value = iparams.credentials[id];
  }
}
function handleOptionChange(action, rowId) {
  if (action === "add") {
    createDDLForAgents();
  } else if (action === "delete") {
    handleDelete(rowId);
  }
}

const handleVerifyBtn = async (rowId) => {
  const select = document.getElementById(`agent-list-${rowId}`);
  const input = document.getElementById(`input-${rowId}`);
  const button = document.getElementById(`btn-${rowId}`);

  try {
    if (!select.value || !input.value) {
      showNotification(
        "error",
        "Please select the agent and enter API key. Both are required"
      );
      return;
    }
    button.disabled = true;
    button.loading = true;
    const isValid = await validateFdCredentials(
      iparams.domain,
      input.value.trim()
    );
    if (isValid) {
      handlePhillElement("green", rowId);
      iparams = {
        ...iparams,
        credentials: {
          ...iparams.credentials,
          [`${select.value}`]: input.value.trim(),
        },
        agent_ids: iparams.agent_ids.includes(select.value)
          ? iparams.agent_ids
          : [...iparams.agent_ids, select.value],
      };
      console.log(iparams);
    }
  } catch (error) {
    console.error(error);
  } finally {
    button.disabled = false;
    button.loading = false;
  }
};

const handleDelete = (rowId) => {
  const select = document.getElementById(`agent-list-${rowId}`);
  if (select.value) {
    delete iparams.credentials[select.value];
    iparams.agent_ids = iparams.agent_ids.filter((id) => id !== select.value);
    showNotification("success", `API key deleted successffully`);
  }
  const row = document.getElementById(`row-${rowId}`);
  if (iparams.agent_ids.length === 0) {
    select.value = undefined;
    document.getElementById(`input-${rowId}`).value = "";
    handlePhillElement("red", rowId);
    return;
  }
  if (!row) return;
  row.remove();
  console.log(iparams);
};

const handlePhillElement = (color, rowId) => {
  const phillMessage = document.getElementById(`verified-${rowId}`);
  phillMessage.color = color;
  phillMessage.replaceChildren();
  phillMessage.textContent = color === "green" ? "Verified" : "Not Verified";
  const icon = document.createElement("fw-icon");
  icon.setAttribute(
    "name",
    color === "green" ? "circle-check" : "circle-cross"
  );
  icon.setAttribute("slot", "icon");
  phillMessage.appendChild(icon);
};

const handleAgentChange = (e) => {
  if (!e.target.value) return;
  const existingAgent = iparams.agent_ids.includes(e.target.value);
  if (existingAgent) showNotification("warning", "Agent already exists");
};

const getTicketFields = async (values) => {
  try {
    const { response, status } = await client.request.invokeTemplate(
      "getTicketFieldsForSettings",
      {
        context: {
          domain: iparams.domain,
          api_key: iparams.api_key,
        },
      }
    );
    if (status === 200) {
      const select = document.getElementById("ticket-fields");
      const data = JSON.parse(response);
      console.log(data);

      const skipTypes = [
        "nested_field",
        "default_subject",
        "default_description",
        "custom_checkbox",
        "custom_paragraph",
      ];

      select.options = data
        .filter((item) => !skipTypes.includes(item.type))
        .map((item) => ({
          text: item.label,
          value: `${item.name},${item.label},${item.type}`,
        }));

      if (values) select.value = values;
    }
  } catch (error) {
    console.error(error);
  }
};

const handleTicketFields = (e) => {
  iparams.ticket_fields = e.target.value;
};

const handleToggleChange = (e) => {
  console.log(e.target.checked);

  iparams["enable_api_key_access"] = e.target.checked;
  if (e.target.checked) $("#wrapper").show();
  else $("#wrapper").hide();
};
